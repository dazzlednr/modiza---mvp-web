-- Keep the database authorization rule aligned with the application rule.
-- Administrators can use space-host tools without carrying a duplicate
-- space_host role. Ownership checks still limit submissions to their own space.

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
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if (
    not public.current_user_has_role('space_host')
    and not public.current_user_is_admin()
  ) or not public.current_user_is_active() then
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

  select * into request_row
  from public.space_verification_requests
  where idempotency_key=p_idempotency_key
    and applicant_id=auth.uid();
  if request_row.id is not null then
    return request_row;
  end if;

  select * into s
  from public.spaces
  where id=p_space_id
  for update;

  if s.id is null then
    raise exception 'SPACE_NOT_FOUND' using errcode='P0002';
  end if;
  if s.owner_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if s.status not in ('draft','revision_requested','rejected') then
    if s.status='pending' then
      select * into request_row
      from public.space_verification_requests
      where space_id=s.id
        and idempotency_key=p_idempotency_key;
      if request_row.id is not null then
        return request_row;
      end if;
    end if;
    raise exception 'SPACE_NOT_SUBMITTABLE' using errcode='22023';
  end if;

  if coalesce(trim(s.name),'')=''
     or coalesce(trim(s.space_type),'')=''
     or coalesce(trim(s.address),'')=''
     or coalesce(trim(s.description),'')=''
     or not exists(
       select 1
       from public.space_images i
       where i.space_id=s.id
     ) then
    raise exception 'SPACE_INFORMATION_INCOMPLETE' using errcode='22023';
  end if;

  insert into public.space_verification_requests(
    space_id,
    applicant_id,
    status,
    contact_name,
    contact_phone,
    relationship_type,
    relationship_detail,
    applicant_note,
    idempotency_key
  ) values(
    s.id,
    auth.uid(),
    'pending',
    trim(p_contact_name),
    trim(p_contact_phone),
    p_relationship_type,
    nullif(trim(p_relationship_detail),''),
    nullif(trim(p_applicant_note),''),
    p_idempotency_key
  )
  returning * into request_row;

  for evidence_item in
    select value from jsonb_array_elements(p_evidence)
  loop
    if coalesce(evidence_item->>'storagePath','')
       not like auth.uid()::text||'/'||s.id::text||'/%' then
      raise exception 'INVALID_EVIDENCE_PATH' using errcode='42501';
    end if;

    insert into public.space_verification_files(
      request_id,
      uploaded_by,
      client_file_id,
      storage_path,
      original_name,
      mime_type,
      file_size
    ) values(
      request_row.id,
      auth.uid(),
      (evidence_item->>'clientFileId')::uuid,
      evidence_item->>'storagePath',
      evidence_item->>'originalName',
      evidence_item->>'mimeType',
      (evidence_item->>'fileSize')::bigint
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

  insert into public.notifications(
    user_id,
    type,
    title,
    message,
    link,
    idempotency_key
  ) values(
    auth.uid(),
    'space_verification_submitted',
    '공간 인증 신청이 접수되었어요',
    s.name||' 공간 정보를 관리자가 확인하고 있어요.',
    '/dashboard/spaces',
    'space-verification-submitted:'||request_row.id
  )
  on conflict(idempotency_key) do nothing;

  return request_row;
end
$$;

revoke all on function public.submit_space_verification(
  uuid,text,text,text,text,text,jsonb,uuid
) from public,anon;

grant execute on function public.submit_space_verification(
  uuid,text,text,text,text,text,jsonb,uuid
) to authenticated;

notify pgrst, 'reload schema';
