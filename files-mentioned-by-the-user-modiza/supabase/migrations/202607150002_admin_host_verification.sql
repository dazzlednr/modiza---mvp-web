-- MODIZA admin console and verified space-host workflow.
-- Keeps the existing multi-role profiles.roles model:
-- user=member, host_pending=host_pending, host=space_host, admin=admin.

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active','suspended'));

create or replace function public.normalize_profile_roles(input_roles text[])
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(role order by position), array['member']::text[])
  from (
    select distinct role, case role when 'member' then 1 when 'community_host' then 2
      when 'host_pending' then 3 when 'space_host' then 4 when 'admin' then 5 end position
    from unnest(coalesce(input_roles,array[]::text[]) || array['member']::text[]) role
    where role = any(array['member','community_host','host_pending','space_host','admin']::text[])
  ) normalized;
$$;
update public.profiles set roles=public.normalize_profile_roles(roles);
alter table public.profiles drop constraint if exists profiles_roles_valid;
alter table public.profiles add constraint profiles_roles_valid check (
  roles=public.normalize_profile_roles(roles)
  and roles <@ array['member','community_host','host_pending','space_host','admin']::text[]
  and roles @> array['member']::text[]
);

-- Existing owner policies use this helper. Replacing it makes suspension apply
-- to direct Supabase SDK calls as well as to the Next.js API layer.
create or replace function public.current_user_has_role(required_role text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid()
      and account_status='active'
      and roles @> array[required_role]::text[]
  );
$$;
revoke all on function public.current_user_has_role(text) from public,anon;
grant execute on function public.current_user_has_role(text) to authenticated;

-- Space-host is no longer self-activatable. Existing approved hosts are preserved.
create or replace function public.add_current_user_role(requested_role text)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if requested_role <> 'community_host' then raise exception 'ROLE_NOT_ALLOWED' using errcode='22023'; end if;
  update public.profiles set roles=public.normalize_profile_roles(roles || array[requested_role])
    where id=auth.uid() and account_status='active' returning * into result;
  if result.id is null then raise exception 'PROFILE_NOT_FOUND_OR_SUSPENDED' using errcode='P0002'; end if;
  return result;
end $$;

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and account_status='active' and roles @> array['admin']::text[]);
$$;
create or replace function public.current_user_is_active()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and account_status='active');
$$;
revoke all on function public.current_user_is_admin() from public,anon;
revoke all on function public.current_user_is_active() from public,anon;
grant execute on function public.current_user_is_admin(), public.current_user_is_active() to authenticated;

create table if not exists public.space_host_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null,
  email text not null,
  phone text not null,
  space_name text not null,
  space_address text not null,
  space_type text not null,
  relationship text not null check (relationship in ('representative','business_owner','space_owner','tenant','employee','delegated_operator','other')),
  related_link text,
  message text,
  evidence_path text,
  evidence_mime_type text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists space_host_applications_one_pending
  on public.space_host_applications(user_id) where status='pending';
create index if not exists space_host_applications_status_created_idx
  on public.space_host_applications(status,created_at desc);

alter table public.spaces add column if not exists deleted_at timestamptz,
  add column if not exists moderation_reason text;
alter table public.communities add column if not exists deleted_at timestamptz,
  add column if not exists moderation_reason text,
  add column if not exists report_count integer not null default 0;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check(target_type in ('user','community','event','space')),
  target_id uuid not null, report_type text not null, content text not null,
  status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')),
  processed_by uuid references auth.users(id) on delete set null, processed_at timestamptz,
  resolution_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists reports_status_created_idx on public.reports(status,created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), admin_id uuid not null references auth.users(id) on delete restrict,
  action_type text not null, target_type text not null, target_id uuid,
  reason text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit_logs(target_type,target_id);

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='space_host_applications_updated') then
    create trigger space_host_applications_updated before update on public.space_host_applications
      for each row execute function public.set_updated_at();
  end if;
  if not exists(select 1 from pg_trigger where tgname='reports_updated') then
    create trigger reports_updated before update on public.reports
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.space_host_applications enable row level security;
alter table public.reports enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "users read own host applications" on public.space_host_applications;
drop policy if exists "users submit host applications" on public.space_host_applications;
drop policy if exists "admins update host applications" on public.space_host_applications;
drop policy if exists "users create reports" on public.reports;
drop policy if exists "users read own reports and admins read all" on public.reports;
drop policy if exists "admins update reports" on public.reports;
drop policy if exists "admins read audit logs" on public.admin_audit_logs;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "admins manage spaces" on public.spaces;
drop policy if exists "admins manage communities" on public.communities;

create policy "users read own host applications" on public.space_host_applications
  for select to authenticated using(user_id=auth.uid() or public.current_user_is_admin());
create policy "users submit host applications" on public.space_host_applications
  for insert to authenticated with check(user_id=auth.uid() and status='pending' and public.current_user_is_active());
create policy "admins update host applications" on public.space_host_applications
  for update to authenticated using(public.current_user_is_admin()) with check(public.current_user_is_admin());
create policy "users create reports" on public.reports for insert to authenticated
  with check(reporter_id=auth.uid() and public.current_user_is_active());
create policy "users read own reports and admins read all" on public.reports for select to authenticated
  using(reporter_id=auth.uid() or public.current_user_is_admin());
create policy "admins update reports" on public.reports for update to authenticated
  using(public.current_user_is_admin()) with check(public.current_user_is_admin());
create policy "admins read audit logs" on public.admin_audit_logs for select to authenticated
  using(public.current_user_is_admin());

-- Additive administrator policies preserve owner/public policies.
create policy "admins manage profiles" on public.profiles for select to authenticated using(public.current_user_is_admin());
create policy "admins manage spaces" on public.spaces for all to authenticated
  using(public.current_user_is_admin()) with check(public.current_user_is_admin());
create policy "admins manage communities" on public.communities for all to authenticated
  using(public.current_user_is_admin()) with check(public.current_user_is_admin());

grant select,insert on public.space_host_applications to authenticated;
grant update on public.space_host_applications to authenticated;
grant select,insert,update on public.reports to authenticated;
grant select on public.admin_audit_logs to authenticated;
grant all on public.space_host_applications,public.reports,public.admin_audit_logs to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('space-host-evidence','space-host-evidence',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "applicants upload host evidence" on storage.objects;
drop policy if exists "applicants and admins read host evidence" on storage.objects;
create policy "applicants upload host evidence" on storage.objects for insert to authenticated
  with check(bucket_id='space-host-evidence' and (storage.foldername(name))[1]=auth.uid()::text and public.current_user_is_active());
create policy "applicants and admins read host evidence" on storage.objects for select to authenticated
  using(bucket_id='space-host-evidence' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_is_admin()));

-- Atomic approval/rejection and immutable audit trail.
create or replace function public.process_space_host_application(p_application_id uuid,p_result text,p_reason text default null)
returns public.space_host_applications language plpgsql security definer set search_path='' as $$
declare app public.space_host_applications; new_roles text[];
begin
  if not public.current_user_is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_result not in ('approved','rejected') then raise exception 'INVALID_RESULT' using errcode='22023'; end if;
  if p_result='rejected' and coalesce(trim(p_reason),'')='' then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
  select * into app from public.space_host_applications where id=p_application_id for update;
  if app.id is null then raise exception 'APPLICATION_NOT_FOUND' using errcode='P0002'; end if;
  if app.status<>'pending' then raise exception 'ALREADY_PROCESSED' using errcode='22023'; end if;
  update public.space_host_applications set status=p_result,rejection_reason=case when p_result='rejected' then p_reason end,
    reviewed_by=auth.uid(),reviewed_at=now() where id=app.id returning * into app;
  select roles into new_roles from public.profiles where id=app.user_id for update;
  new_roles=array_remove(array_remove(new_roles,'host_pending'),'space_host');
  if p_result='approved' then new_roles=new_roles||array['space_host']; end if;
  update public.profiles set roles=public.normalize_profile_roles(new_roles) where id=app.user_id;
  insert into public.admin_audit_logs(admin_id,action_type,target_type,target_id,reason)
    values(auth.uid(),'space_host_application_'||p_result,'space_host_application',app.id,p_reason);
  return app;
end $$;
revoke all on function public.process_space_host_application(uuid,text,text) from public,anon;
grant execute on function public.process_space_host_application(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';

-- Replace the email placeholder before running this statement separately:
-- update public.profiles set roles=public.normalize_profile_roles(roles||array['admin'])
-- where id=(select id from auth.users where email='관리자 이메일 입력');
