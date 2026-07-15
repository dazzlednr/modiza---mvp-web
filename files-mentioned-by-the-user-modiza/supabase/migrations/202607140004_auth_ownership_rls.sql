-- Part 4-3: auth.uid()-based ownership and RLS.
-- Existing demo rows intentionally keep owner_id/applicant_user_id null.

alter table public.communities
  add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.spaces
  add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table public.community_applications
  add column if not exists applicant_user_id uuid references auth.users(id) on delete set null,
  add column if not exists applicant_contact text,
  add column if not exists answers jsonb not null default '{}'::jsonb;

alter table public.community_applications drop constraint if exists community_applications_status_check;
alter table public.community_applications
  add constraint community_applications_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

create index if not exists communities_owner_idx on public.communities(owner_id);
create index if not exists communities_owner_status_idx on public.communities(owner_id, status);
create index if not exists communities_owner_recruitment_idx on public.communities(owner_id, recruitment_status);
create index if not exists spaces_owner_idx on public.spaces(owner_id);
create index if not exists spaces_owner_status_idx on public.spaces(owner_id, status);
create index if not exists applications_applicant_user_idx on public.community_applications(applicant_user_id, created_at desc);
create unique index if not exists applications_active_user_unique
  on public.community_applications(community_id, applicant_user_id)
  where applicant_user_id is not null and status in ('pending', 'approved');

create or replace function public.current_user_has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and roles @> array[required_role]::text[]
  );
$$;

revoke all on function public.current_user_has_role(text) from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;

do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'communities', 'spaces', 'space_images', 'space_analysis',
        'community_applications', 'schedules', 'checklist_groups', 'checklist_items'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

alter table public.communities enable row level security;
alter table public.spaces enable row level security;
alter table public.space_images enable row level security;
alter table public.space_analysis enable row level security;
alter table public.community_applications enable row level security;
alter table public.schedules enable row level security;
alter table public.checklist_groups enable row level security;
alter table public.checklist_items enable row level security;

create policy "published communities public read"
  on public.communities for select to anon, authenticated
  using (status = 'published' or owner_id = auth.uid());
create policy "community hosts insert owned communities"
  on public.communities for insert to authenticated
  with check (owner_id = auth.uid() and public.current_user_has_role('community_host'));
create policy "community hosts update owned communities"
  on public.communities for update to authenticated
  using (owner_id = auth.uid() and public.current_user_has_role('community_host'))
  with check (owner_id = auth.uid() and public.current_user_has_role('community_host'));
create policy "community hosts delete owned communities"
  on public.communities for delete to authenticated
  using (owner_id = auth.uid() and public.current_user_has_role('community_host'));

create policy "active spaces public read"
  on public.spaces for select to anon, authenticated
  using (status = 'active' or owner_id = auth.uid());
create policy "space hosts insert owned spaces"
  on public.spaces for insert to authenticated
  with check (owner_id = auth.uid() and public.current_user_has_role('space_host'));
create policy "space hosts update owned spaces"
  on public.spaces for update to authenticated
  using (owner_id = auth.uid() and public.current_user_has_role('space_host'))
  with check (owner_id = auth.uid() and public.current_user_has_role('space_host'));
create policy "space hosts delete owned spaces"
  on public.spaces for delete to authenticated
  using (owner_id = auth.uid() and public.current_user_has_role('space_host'));

create policy "space images visible with space"
  on public.space_images for select to anon, authenticated
  using (exists (
    select 1 from public.spaces s
    where s.id = space_id and (s.status = 'active' or s.owner_id = auth.uid())
  ));
create policy "space owners insert images"
  on public.space_images for insert to authenticated
  with check (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid() and public.current_user_has_role('space_host')));
create policy "space owners update images"
  on public.space_images for update to authenticated
  using (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid() and public.current_user_has_role('space_host')))
  with check (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid() and public.current_user_has_role('space_host')));
create policy "space owners delete images"
  on public.space_images for delete to authenticated
  using (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid() and public.current_user_has_role('space_host')));

create policy "space owners manage analysis"
  on public.space_analysis for all to authenticated
  using (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid() and public.current_user_has_role('space_host')))
  with check (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid() and public.current_user_has_role('space_host')));

create policy "applications visible to applicant or community owner"
  on public.community_applications for select to authenticated
  using (
    applicant_user_id = auth.uid()
    or exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid())
  );
create policy "members apply to recruiting communities"
  on public.community_applications for insert to authenticated
  with check (
    applicant_user_id = auth.uid()
    and public.current_user_has_role('member')
    and exists (
      select 1 from public.communities c
      where c.id = community_id
        and c.status = 'published'
        and c.recruitment_status = 'recruiting'
        and c.current_members < c.capacity
        and (c.recruitment_start_at is null or c.recruitment_start_at <= now())
        and (c.recruitment_end_at is null or c.recruitment_end_at > now())
    )
  );

create policy "published upcoming schedules public read"
  on public.schedules for select to anon, authenticated
  using (exists (
    select 1 from public.communities c
    where c.id = community_id
      and ((c.status = 'published' and schedules.status = 'upcoming') or c.owner_id = auth.uid())
  ));
create policy "community owners insert schedules"
  on public.schedules for insert to authenticated
  with check (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')));
create policy "community owners update schedules"
  on public.schedules for update to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')))
  with check (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')));
create policy "community owners delete schedules"
  on public.schedules for delete to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')));

create policy "community owners manage checklist groups"
  on public.checklist_groups for all to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')))
  with check (exists (select 1 from public.communities c where c.id = community_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')));
create policy "community owners manage checklist items"
  on public.checklist_items for all to authenticated
  using (exists (
    select 1 from public.checklist_groups g join public.communities c on c.id = g.community_id
    where g.id = group_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')
  ))
  with check (exists (
    select 1 from public.checklist_groups g join public.communities c on c.id = g.community_id
    where g.id = group_id and c.owner_id = auth.uid() and public.current_user_has_role('community_host')
  ));

revoke all on public.communities, public.spaces, public.space_images, public.space_analysis,
  public.community_applications, public.schedules, public.checklist_groups, public.checklist_items
  from anon, authenticated;
grant select on public.communities, public.spaces, public.space_images, public.schedules to anon;
grant select on public.communities, public.spaces, public.space_images, public.schedules to authenticated;
grant insert, update, delete on public.communities, public.spaces, public.space_images, public.space_analysis,
  public.schedules, public.checklist_groups, public.checklist_items to authenticated;
grant select on public.space_analysis, public.community_applications, public.checklist_groups, public.checklist_items to authenticated;
grant insert on public.community_applications to authenticated;

create or replace function public.cancel_my_application(p_application_id uuid)
returns public.community_applications
language plpgsql security definer set search_path = ''
as $$
declare result public.community_applications;
begin
  update public.community_applications
  set status = 'cancelled'
  where id = p_application_id and applicant_user_id = auth.uid() and status = 'pending'
  returning * into result;
  if result.id is null then raise exception 'APPLICATION_NOT_CANCELLABLE' using errcode = 'P0002'; end if;
  return result;
end;
$$;

create or replace function public.change_application_status_as_owner(
  p_application_id uuid,
  p_status text,
  p_operator_memo text default null
)
returns public.community_applications
language plpgsql security definer set search_path = ''
as $$
declare application_row public.community_applications;
declare community_row public.communities;
begin
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;
  select * into application_row from public.community_applications where id = p_application_id for update;
  if application_row.id is null then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if application_row.status = 'cancelled' then
    raise exception 'CANCELLED_APPLICATION_IS_FINAL' using errcode = '22023';
  end if;
  select * into community_row from public.communities where id = application_row.community_id for update;
  if community_row.owner_id is distinct from auth.uid() or not public.current_user_has_role('community_host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if application_row.status <> 'approved' and p_status = 'approved' then
    if community_row.current_members >= community_row.capacity then
      raise exception 'CAPACITY_FULL' using errcode = 'P0001';
    end if;
    update public.communities set current_members = current_members + 1 where id = community_row.id;
  elsif application_row.status = 'approved' and p_status <> 'approved' then
    update public.communities set current_members = greatest(current_members - 1, 0) where id = community_row.id;
  end if;
  update public.community_applications
  set status = p_status, operator_memo = p_operator_memo
  where id = p_application_id returning * into application_row;
  return application_row;
end;
$$;

revoke all on function public.cancel_my_application(uuid) from public, anon;
grant execute on function public.cancel_my_application(uuid) to authenticated;
revoke all on function public.change_application_status_as_owner(uuid, text, text) from public, anon;
grant execute on function public.change_application_status_as_owner(uuid, text, text) to authenticated;

drop policy if exists "public reads community images bucket" on storage.objects;
drop policy if exists "public reads space images bucket" on storage.objects;
drop policy if exists "owners upload community images" on storage.objects;
drop policy if exists "owners change community images" on storage.objects;
drop policy if exists "owners delete community images" on storage.objects;
drop policy if exists "owners upload space images" on storage.objects;
drop policy if exists "owners change space images" on storage.objects;
drop policy if exists "owners delete space images" on storage.objects;

create policy "public reads community images bucket" on storage.objects for select to anon, authenticated
  using (bucket_id = 'community-images');
create policy "owners upload community images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.communities c where c.id::text = (storage.foldername(name))[2] and c.owner_id = auth.uid())
  );
create policy "owners change community images" on storage.objects for update to authenticated
  using (bucket_id = 'community-images' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.communities c where c.thumbnail_storage_path = name and c.owner_id = auth.uid())
  )) with check (bucket_id = 'community-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete community images" on storage.objects for delete to authenticated
  using (bucket_id = 'community-images' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.communities c where c.thumbnail_storage_path = name and c.owner_id = auth.uid())
  ));

create policy "public reads space images bucket" on storage.objects for select to anon, authenticated
  using (bucket_id = 'space-images');
create policy "owners upload space images" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'space-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.spaces s where s.id::text = (storage.foldername(name))[2] and s.owner_id = auth.uid())
  );
create policy "owners change space images" on storage.objects for update to authenticated
  using (bucket_id = 'space-images' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.space_images i join public.spaces s on s.id = i.space_id where i.storage_path = name and s.owner_id = auth.uid())
  )) with check (bucket_id = 'space-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owners delete space images" on storage.objects for delete to authenticated
  using (bucket_id = 'space-images' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.space_images i join public.spaces s on s.id = i.space_id where i.storage_path = name and s.owner_id = auth.uid())
  ));
