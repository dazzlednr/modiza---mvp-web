-- Per-space verification workflow.
-- A space_host role is only a qualification to submit spaces. It never grants
-- permission to publish or approve an individual space.

-- Preserve every legacy public space as an approved space.
alter table public.spaces drop constraint if exists spaces_status_check;
update public.spaces set status='approved' where status='active';
alter table public.spaces
  add constraint spaces_status_check
  check (status in (
    'draft','pending','revision_requested','approved',
    'rejected','suspended','inactive'
  ));

alter table public.spaces
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists relationship_type text,
  add column if not exists relationship_detail text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

update public.spaces
set approved_at=coalesce(approved_at,updated_at,created_at)
where status='approved';

comment on column public.spaces.status is
  'Canonical per-space verification/publication state. space_host role alone never changes this value to approved.';

create table if not exists public.space_verification_requests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  applicant_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','revision_requested','approved','rejected','cancelled')),
  contact_name text not null,
  contact_phone text not null,
  relationship_type text not null
    check (relationship_type in ('owner','employee','manager','tenant','other')),
  relationship_detail text,
  applicant_note text,
  revision_request_reason text,
  rejection_reason text,
  idempotency_key uuid not null unique,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.space_verification_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.space_verification_requests(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  client_file_id uuid not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null
    check (mime_type in ('application/pdf','image/jpeg','image/png')),
  file_size bigint not null check (file_size>0 and file_size<=10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,client_file_id)
);

create unique index if not exists space_verification_one_pending
  on public.space_verification_requests(space_id) where status='pending';
create index if not exists space_verification_status_created_idx
  on public.space_verification_requests(status,created_at desc);
create index if not exists space_verification_space_created_idx
  on public.space_verification_requests(space_id,created_at desc);
create index if not exists space_verification_applicant_idx
  on public.space_verification_requests(applicant_id,created_at desc);
create index if not exists space_verification_files_request_idx
  on public.space_verification_files(request_id);

drop trigger if exists space_verification_requests_updated on public.space_verification_requests;
create trigger space_verification_requests_updated
before update on public.space_verification_requests
for each row execute function public.set_updated_at();

drop trigger if exists space_verification_files_updated on public.space_verification_files;
create trigger space_verification_files_updated
before update on public.space_verification_files
for each row execute function public.set_updated_at();

alter table public.space_verification_requests enable row level security;
alter table public.space_verification_files enable row level security;

-- Replace legacy active-space policies with approved-space policies.
drop policy if exists "active spaces public read" on public.spaces;
drop policy if exists "approved spaces public read" on public.spaces;
create policy "approved spaces public read" on public.spaces
  for select to anon,authenticated
  using (
    status='approved'
    or owner_id=auth.uid()
    or public.current_user_is_admin()
  );

drop policy if exists "active space images public read" on public.space_images;
drop policy if exists "space images visible with space" on public.space_images;
drop policy if exists "approved space images visible" on public.space_images;
create policy "approved space images visible" on public.space_images
  for select to anon,authenticated
  using (exists (
    select 1 from public.spaces s
    where s.id=space_id and (
      s.status='approved'
      or s.owner_id=auth.uid()
      or public.current_user_is_admin()
    )
  ));

drop policy if exists "space owners insert images" on public.space_images;
drop policy if exists "space owners update images" on public.space_images;
drop policy if exists "space owners delete images" on public.space_images;
create policy "space owners insert images"
  on public.space_images for insert to authenticated
  with check (exists (
    select 1 from public.spaces s where s.id=space_id
      and s.owner_id=auth.uid()
      and s.status not in ('pending','suspended')
      and public.current_user_has_role('space_host')
  ));
create policy "space owners update images"
  on public.space_images for update to authenticated
  using (exists (
    select 1 from public.spaces s where s.id=space_id
      and s.owner_id=auth.uid()
      and s.status not in ('pending','suspended')
      and public.current_user_has_role('space_host')
  ))
  with check (exists (
    select 1 from public.spaces s where s.id=space_id
      and s.owner_id=auth.uid()
      and s.status not in ('pending','suspended')
      and public.current_user_has_role('space_host')
  ));
create policy "space owners delete images"
  on public.space_images for delete to authenticated
  using (exists (
    select 1 from public.spaces s where s.id=space_id
      and s.owner_id=auth.uid()
      and s.status not in ('pending','suspended')
      and public.current_user_has_role('space_host')
  ));

drop policy if exists "space owners insert verification requests" on public.space_verification_requests;
drop policy if exists "space verification requests visible to owner and admin" on public.space_verification_requests;
create policy "space verification requests visible to owner and admin"
  on public.space_verification_requests for select to authenticated
  using (applicant_id=auth.uid() or public.current_user_is_admin());

drop policy if exists "space verification files visible to owner and admin" on public.space_verification_files;
create policy "space verification files visible to owner and admin"
  on public.space_verification_files for select to authenticated
  using (exists (
    select 1 from public.space_verification_requests r
    where r.id=request_id
      and (r.applicant_id=auth.uid() or public.current_user_is_admin())
  ));

revoke insert,update,delete on public.space_verification_requests from anon,authenticated;
revoke insert,update,delete on public.space_verification_files from anon,authenticated;
grant select on public.space_verification_requests,public.space_verification_files to authenticated;
grant all on public.space_verification_requests,public.space_verification_files to service_role;

-- Only a draft owned by a qualified space host may be inserted directly.
drop policy if exists "space hosts insert owned spaces" on public.spaces;
create policy "space hosts insert owned draft spaces"
  on public.spaces for insert to authenticated
  with check (
    owner_id=auth.uid()
    and status='draft'
    and public.current_user_has_role('space_host')
    and public.current_user_is_active()
  );

drop policy if exists "space hosts update owned spaces" on public.spaces;
create policy "space hosts update owned editable spaces"
  on public.spaces for update to authenticated
  using (
    owner_id=auth.uid()
    and public.current_user_has_role('space_host')
    and status not in ('pending','suspended')
  )
  with check (
    owner_id=auth.uid()
    and public.current_user_has_role('space_host')
    and status not in ('pending','suspended')
  );

drop policy if exists "space hosts delete owned spaces" on public.spaces;
create policy "space hosts delete owned nonreviewing spaces"
  on public.spaces for delete to authenticated
  using (
    owner_id=auth.uid()
    and public.current_user_has_role('space_host')
    and status in ('draft','revision_requested','rejected')
  );

-- Owners may edit their own rows. The trigger below protects review state and
-- automatically removes an approved space from public results after a material
-- address/relationship change.
create or replace function public.protect_space_verification_state()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  is_privileged boolean :=
    current_user in ('postgres','service_role')
    or public.current_user_is_admin();
  material_change boolean :=
    new.address is distinct from old.address
    or new.address_detail is distinct from old.address_detail
    or new.relationship_type is distinct from old.relationship_type
    or new.relationship_detail is distinct from old.relationship_detail;
begin
  if is_privileged then return new; end if;

  if material_change and old.status='approved' then
    new.status:='revision_requested';
    new.approved_at:=null;
    new.approved_by:=null;
  elsif new.status is distinct from old.status
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.suspended_at is distinct from old.suspended_at
     or new.suspension_reason is distinct from old.suspension_reason then
    raise exception 'SPACE_REVIEW_STATE_IS_SERVER_MANAGED' using errcode='42501';
  end if;
  return new;
end
$$;

drop trigger if exists protect_space_verification_state on public.spaces;
create trigger protect_space_verification_state
before update on public.spaces
for each row execute function public.protect_space_verification_state();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'space-verification-evidence',
  'space-verification-evidence',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "space owners upload verification evidence" on storage.objects;
drop policy if exists "space owners read own verification evidence" on storage.objects;
drop policy if exists "space owners delete verification evidence" on storage.objects;
drop policy if exists "admins read verification evidence" on storage.objects;
create policy "space owners upload verification evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='space-verification-evidence'
    and (storage.foldername(name))[1]=auth.uid()::text
    and public.current_user_has_role('space_host')
  );
create policy "space owners read own verification evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id='space-verification-evidence'
    and (storage.foldername(name))[1]=auth.uid()::text
  );
create policy "space owners delete verification evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id='space-verification-evidence'
    and (storage.foldername(name))[1]=auth.uid()::text
  );
create policy "admins read verification evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id='space-verification-evidence'
    and public.current_user_is_admin()
  );

create or replace function public.submit_space_verification(
  p_space_id uuid,
  p_contact_name text,
  p_contact_phone text,
  p_relationship_type text,
  p_relationship_detail text,
  p_applicant_note text,
  p_evidence jsonb,
  p_idempotency_key uuid
)
returns public.space_verification_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.spaces;
  request_row public.space_verification_requests;
  evidence_item jsonb;
  evidence_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.current_user_has_role('space_host') or not public.current_user_is_active() then
    raise exception 'SPACE_HOST_QUALIFICATION_REQUIRED' using errcode='42501';
  end if;
  if p_relationship_type not in ('owner','employee','manager','tenant','other') then
    raise exception 'INVALID_RELATIONSHIP' using errcode='22023';
  end if;
  if coalesce(trim(p_contact_name),'')='' or coalesce(trim(p_contact_phone),'')='' then
    raise exception 'CONTACT_REQUIRED' using errcode='22023';
  end if;
  if p_relationship_type='other' and coalesce(trim(p_relationship_detail),'')='' then
    raise exception 'RELATIONSHIP_DETAIL_REQUIRED' using errcode='22023';
  end if;
  evidence_count:=jsonb_array_length(coalesce(p_evidence,'[]'::jsonb));
  if evidence_count<1 or evidence_count>3 then
    raise exception 'EVIDENCE_COUNT_INVALID' using errcode='22023';
  end if;

  select * into request_row from public.space_verification_requests
  where idempotency_key=p_idempotency_key and applicant_id=auth.uid();
  if request_row.id is not null then return request_row; end if;

  select * into s from public.spaces where id=p_space_id for update;
  if s.id is null then raise exception 'SPACE_NOT_FOUND' using errcode='P0002'; end if;
  if s.owner_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if s.status not in ('draft','revision_requested','rejected') then
    if s.status='pending' then
      select * into request_row from public.space_verification_requests
      where space_id=s.id and idempotency_key=p_idempotency_key;
      if request_row.id is not null then return request_row; end if;
    end if;
    raise exception 'SPACE_NOT_SUBMITTABLE' using errcode='22023';
  end if;

  if coalesce(trim(s.name),'')='' or coalesce(trim(s.space_type),'')=''
     or coalesce(trim(s.address),'')='' or coalesce(trim(s.description),'')=''
     or not exists(select 1 from public.space_images i where i.space_id=s.id) then
    raise exception 'SPACE_INFORMATION_INCOMPLETE' using errcode='22023';
  end if;

  insert into public.space_verification_requests(
    space_id,applicant_id,status,contact_name,contact_phone,
    relationship_type,relationship_detail,applicant_note,idempotency_key
  ) values(
    s.id,auth.uid(),'pending',trim(p_contact_name),trim(p_contact_phone),
    p_relationship_type,nullif(trim(p_relationship_detail),''),
    nullif(trim(p_applicant_note),''),p_idempotency_key
  ) returning * into request_row;

  for evidence_item in select value from jsonb_array_elements(p_evidence)
  loop
    if coalesce(evidence_item->>'storagePath','') not like auth.uid()::text||'/'||s.id::text||'/%' then
      raise exception 'INVALID_EVIDENCE_PATH' using errcode='42501';
    end if;
    insert into public.space_verification_files(
      request_id,uploaded_by,client_file_id,storage_path,original_name,mime_type,file_size
    ) values(
      request_row.id,auth.uid(),(evidence_item->>'clientFileId')::uuid,
      evidence_item->>'storagePath',evidence_item->>'originalName',
      evidence_item->>'mimeType',(evidence_item->>'fileSize')::bigint
    );
  end loop;

  update public.spaces
  set status='pending',
      contact_name=trim(p_contact_name),
      contact_phone=trim(p_contact_phone),
      relationship_type=p_relationship_type,
      relationship_detail=nullif(trim(p_relationship_detail),''),
      approved_at=null,
      approved_by=null,
      suspended_at=null,
      suspension_reason=null
  where id=s.id;

  insert into public.notifications(user_id,type,title,message,link,idempotency_key)
  values(
    auth.uid(),'space_verification_submitted','공간 인증 신청이 접수되었어요',
    s.name||' 공간 정보를 관리자가 확인하고 있어요.',
    '/dashboard/spaces','space-verification-submitted:'||request_row.id
  ) on conflict(idempotency_key) do nothing;

  return request_row;
end
$$;

create or replace function public.cancel_space_verification(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare s public.spaces;
begin
  select * into s from public.spaces where id=p_space_id for update;
  if s.id is null or s.owner_id is distinct from auth.uid() then
    raise exception 'SPACE_NOT_FOUND' using errcode='P0002';
  end if;
  if s.status<>'pending' then raise exception 'SPACE_NOT_PENDING' using errcode='22023'; end if;
  update public.space_verification_requests
    set status='cancelled'
    where space_id=s.id and status='pending';
  update public.spaces set status='draft' where id=s.id;
end
$$;

create or replace function public.set_my_space_inactive(p_space_id uuid,p_inactive boolean)
returns public.spaces
language plpgsql
security definer
set search_path=''
as $$
declare s public.spaces;
begin
  select * into s from public.spaces where id=p_space_id for update;
  if s.id is null or s.owner_id is distinct from auth.uid()
     or not public.current_user_has_role('space_host') then
    raise exception 'SPACE_NOT_FOUND' using errcode='P0002';
  end if;
  if p_inactive and s.status<>'approved' then
    raise exception 'ONLY_APPROVED_SPACE_CAN_BE_INACTIVE' using errcode='22023';
  end if;
  if not p_inactive and s.status<>'inactive' then
    raise exception 'SPACE_NOT_INACTIVE' using errcode='22023';
  end if;
  update public.spaces
  set status=case when p_inactive then 'inactive' else 'approved' end
  where id=s.id returning * into s;
  return s;
end
$$;

create or replace function public.review_space_verification(
  p_request_id uuid,
  p_action text,
  p_reason text default null
)
returns public.space_verification_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  request_row public.space_verification_requests;
  s public.spaces;
begin
  if not public.current_user_is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_action not in ('approved','revision_requested','rejected') then
    raise exception 'INVALID_ACTION' using errcode='22023';
  end if;
  if p_action in ('revision_requested','rejected') and coalesce(trim(p_reason),'')='' then
    raise exception 'REASON_REQUIRED' using errcode='22023';
  end if;

  select * into request_row from public.space_verification_requests
  where id=p_request_id for update;
  if request_row.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if request_row.status<>'pending' then raise exception 'ALREADY_PROCESSED' using errcode='22023'; end if;
  select * into s from public.spaces where id=request_row.space_id for update;

  update public.space_verification_requests
  set status=p_action,
      revision_request_reason=case when p_action='revision_requested' then trim(p_reason) end,
      rejection_reason=case when p_action='rejected' then trim(p_reason) end,
      reviewed_at=now(),
      reviewed_by=auth.uid()
  where id=request_row.id
  returning * into request_row;

  update public.spaces
  set status=p_action,
      approved_at=case when p_action='approved' then now() end,
      approved_by=case when p_action='approved' then auth.uid() end,
      suspended_at=null,
      suspension_reason=null
  where id=s.id;

  insert into public.notifications(user_id,type,title,message,link,idempotency_key)
  values(
    request_row.applicant_id,
    'space_verification_'||p_action,
    case p_action
      when 'approved' then '공간 인증이 승인되었어요'
      when 'revision_requested' then '공간 인증에 보완이 필요해요'
      else '공간 인증 결과를 확인해주세요'
    end,
    case p_action
      when 'approved' then s.name||' 공간이 공개되었습니다.'
      when 'revision_requested' then s.name||' 공간의 보완 요청을 확인하고 다시 제출해주세요.'
      else s.name||' 공간 인증이 반려되었습니다. 사유를 확인해주세요.'
    end,
    '/dashboard/spaces',
    'space-verification-result:'||request_row.id||':'||p_action
  ) on conflict(idempotency_key) do nothing;

  insert into public.admin_audit_logs(admin_id,action_type,target_type,target_id,reason)
  values(auth.uid(),'space_verification_'||p_action,'space_verification_request',request_row.id,p_reason);
  return request_row;
end
$$;

create or replace function public.set_space_suspension(
  p_space_id uuid,
  p_suspend boolean,
  p_reason text default null
)
returns public.spaces
language plpgsql
security definer
set search_path=''
as $$
declare s public.spaces;
begin
  if not public.current_user_is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_suspend and coalesce(trim(p_reason),'')='' then
    raise exception 'REASON_REQUIRED' using errcode='22023';
  end if;
  select * into s from public.spaces where id=p_space_id for update;
  if s.id is null then raise exception 'SPACE_NOT_FOUND' using errcode='P0002'; end if;
  if p_suspend and s.status<>'approved' then raise exception 'ONLY_APPROVED_SPACE_CAN_BE_SUSPENDED' using errcode='22023'; end if;
  if not p_suspend and s.status<>'suspended' then raise exception 'SPACE_NOT_SUSPENDED' using errcode='22023'; end if;

  update public.spaces
  set status=case when p_suspend then 'suspended' else 'approved' end,
      suspended_at=case when p_suspend then now() end,
      suspension_reason=case when p_suspend then trim(p_reason) end
  where id=s.id returning * into s;

  insert into public.notifications(user_id,type,title,message,link,idempotency_key)
  values(
    s.owner_id,
    case when p_suspend then 'space_suspended' else 'space_unsuspended' end,
    case when p_suspend then '공간 공개가 중지되었어요' else '공간 공개가 다시 시작되었어요' end,
    s.name||case when p_suspend then ' 공간의 공개가 관리자에 의해 중지되었습니다.' else ' 공간이 다시 공개되었습니다.' end,
    '/dashboard/spaces',
    'space-suspension:'||s.id||':'||case when p_suspend then 'on:'||extract(epoch from s.suspended_at)::text else 'off:'||extract(epoch from now())::text end
  );
  insert into public.admin_audit_logs(admin_id,action_type,target_type,target_id,reason)
  values(auth.uid(),case when p_suspend then 'space_suspend' else 'space_unsuspend' end,'space',s.id,p_reason);
  return s;
end
$$;

revoke all on function public.submit_space_verification(uuid,text,text,text,text,text,jsonb,uuid) from public,anon;
revoke all on function public.cancel_space_verification(uuid) from public,anon;
revoke all on function public.set_my_space_inactive(uuid,boolean) from public,anon;
revoke all on function public.review_space_verification(uuid,text,text) from public,anon;
revoke all on function public.set_space_suspension(uuid,boolean,text) from public,anon;
grant execute on function public.submit_space_verification(uuid,text,text,text,text,text,jsonb,uuid) to authenticated;
grant execute on function public.cancel_space_verification(uuid) to authenticated;
grant execute on function public.set_my_space_inactive(uuid,boolean) to authenticated;
grant execute on function public.review_space_verification(uuid,text,text) to authenticated;
grant execute on function public.set_space_suspension(uuid,boolean,text) to authenticated;

notify pgrst,'reload schema';
