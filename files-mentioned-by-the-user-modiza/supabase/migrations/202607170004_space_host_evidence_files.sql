-- Multiple evidence files for space-host verification.
-- The existing single-file columns remain for backward compatibility.

alter table public.space_host_applications
  add column if not exists evidence_paths text[] not null default '{}'::text[],
  add column if not exists evidence_mime_types text[] not null default '{}'::text[];

update public.space_host_applications
set evidence_paths = array[evidence_path],
    evidence_mime_types = case
      when evidence_mime_type is null then '{}'::text[]
      else array[evidence_mime_type]
    end
where evidence_path is not null
  and cardinality(evidence_paths) = 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'space_host_applications_evidence_paths_limit'
  ) then
    alter table public.space_host_applications
      add constraint space_host_applications_evidence_paths_limit
      check (
        cardinality(evidence_paths) between 1 and 3
        or (related_link is not null and evidence_path is null)
      ) not valid;
  end if;
end
$$;

comment on column public.space_host_applications.space_address is
  'Verification-time address used only as the editable initial value for a new space after approval.';
comment on column public.space_host_applications.evidence_paths is
  'Private Storage object paths for 1 to 3 verification evidence files; each object is limited to 10 MB by the bucket.';

-- Keep role processing atomic and notify the applicant of the review result.
create or replace function public.process_space_host_application(
  p_application_id uuid,
  p_result text,
  p_reason text default null
)
returns public.space_host_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  app public.space_host_applications;
  new_roles text[];
begin
  if not public.current_user_is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode='42501';
  end if;
  if p_result not in ('approved','rejected') then
    raise exception 'INVALID_RESULT' using errcode='22023';
  end if;
  if p_result='rejected' and coalesce(trim(p_reason),'')='' then
    raise exception 'REASON_REQUIRED' using errcode='22023';
  end if;

  select * into app
  from public.space_host_applications
  where id=p_application_id
  for update;
  if app.id is null then raise exception 'APPLICATION_NOT_FOUND' using errcode='P0002'; end if;
  if app.status<>'pending' then raise exception 'ALREADY_PROCESSED' using errcode='22023'; end if;

  update public.space_host_applications
  set status=p_result,
      rejection_reason=case when p_result='rejected' then p_reason end,
      reviewed_by=auth.uid(),
      reviewed_at=now()
  where id=app.id
  returning * into app;

  select roles into new_roles from public.profiles where id=app.user_id for update;
  new_roles=array_remove(array_remove(new_roles,'host_pending'),'space_host');
  if p_result='approved' then new_roles=new_roles||array['space_host']; end if;
  update public.profiles
  set roles=public.normalize_profile_roles(new_roles)
  where id=app.user_id;

  insert into public.notifications(user_id,type,title,message,link,idempotency_key)
  values(
    app.user_id,
    'space_host_application_'||p_result,
    case when p_result='approved' then '공간 운영자 인증이 승인되었어요' else '공간 운영자 인증 결과를 확인해주세요' end,
    case when p_result='approved'
      then '이제 공간을 등록할 수 있어요. 인증 신청 주소를 확인하고 공간 정보를 완성해주세요.'
      else '공간 운영자 인증 신청이 반려되었어요. 반려 사유를 확인한 뒤 다시 신청해주세요.'
    end,
    case when p_result='approved' then '/spaces/register' else '/space-host/apply' end,
    'space-host-application-result:'||app.id
  )
  on conflict(idempotency_key) do nothing;

  insert into public.admin_audit_logs(admin_id,action_type,target_type,target_id,reason)
  values(auth.uid(),'space_host_application_'||p_result,'space_host_application',app.id,p_reason);
  return app;
end
$$;

revoke all on function public.process_space_host_application(uuid,text,text) from public,anon;
grant execute on function public.process_space_host_application(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
