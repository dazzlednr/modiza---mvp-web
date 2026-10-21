-- MODIZA operation automation: keep a host's first application decision final.
-- Repeating the same request remains idempotent so a network retry never
-- duplicates the participant count or the participant notification.

create or replace function public.process_community_application_decision(
  p_application_id uuid,
  p_status text,
  p_operator_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_row public.community_applications;
  community_row public.communities;
  previous_status text;
  open_chat_registered boolean := false;
  notification_id uuid := null;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  select *
    into application_row
  from public.community_applications
  where id = p_application_id
  for update;

  if application_row.id is null then
    raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if application_row.status = 'cancelled' then
    raise exception 'CANCELLED_APPLICATION_IS_FINAL' using errcode = '22023';
  end if;

  select *
    into community_row
  from public.communities
  where id = application_row.community_id
  for update;

  if community_row.owner_id is distinct from auth.uid()
    or not public.current_user_has_role('community_host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  previous_status := application_row.status;

  -- A repeated identical request is harmless. A different decision after the
  -- first result is refused so participants never receive contradictory alerts.
  if previous_status <> 'pending' and previous_status <> p_status then
    raise exception 'APPLICATION_ALREADY_DECIDED' using errcode = 'P0001';
  end if;

  if previous_status = 'pending' and p_status = 'approved' then
    if community_row.current_members >= community_row.capacity then
      raise exception 'CAPACITY_FULL' using errcode = 'P0001';
    end if;
    update public.communities
      set current_members = current_members + 1
    where id = community_row.id;
  end if;

  update public.community_applications
    set status = p_status,
        operator_memo = p_operator_memo
  where id = p_application_id
  returning * into application_row;

  select exists(
    select 1
    from public.community_open_chats
    where community_id = community_row.id
  ) into open_chat_registered;

  if p_status = 'approved' and application_row.applicant_user_id is not null then
    insert into public.notifications(
      user_id, type, title, message, link,
      related_community_id, related_application_id, idempotency_key
    )
    values(
      application_row.applicant_user_id,
      'community_application_approved',
      '커뮤니티 참가가 확정되었어요 🎉',
      community_row.name || case
        when open_chat_registered then ' 참가가 확정되었습니다. 오픈채팅방을 확인해주세요.'
        else ' 참가가 확정되었습니다. 운영자가 오픈채팅방을 준비하고 있어요.'
      end,
      '/mypage/applications/' || application_row.id,
      community_row.id,
      application_row.id,
      'application-approved:' || application_row.id
    )
    on conflict do nothing
    returning id into notification_id;
  elsif p_status = 'rejected' and application_row.applicant_user_id is not null then
    insert into public.notifications(
      user_id, type, title, message, link,
      related_community_id, related_application_id, idempotency_key
    )
    values(
      application_row.applicant_user_id,
      'community_application_rejected',
      '커뮤니티 신청 결과를 확인해주세요',
      community_row.name || ' 참가 신청이 승인되지 않았습니다.',
      '/mypage/applications/' || application_row.id,
      community_row.id,
      application_row.id,
      'application-rejected:' || application_row.id
    )
    on conflict do nothing
    returning id into notification_id;
  end if;

  return jsonb_build_object(
    'application_id', application_row.id,
    'community_id', community_row.id,
    'operator_user_id', auth.uid(),
    'applicant_user_id', application_row.applicant_user_id,
    'previous_status', previous_status,
    'status', application_row.status,
    'notification_created', notification_id is not null,
    'notification_id', notification_id,
    'open_chat_registered', open_chat_registered
  );
end;
$$;

revoke all on function public.process_community_application_decision(uuid, text, text)
  from public, anon;
grant execute on function public.process_community_application_decision(uuid, text, text)
  to authenticated;

-- The legacy RPC is no longer used by the application. Keeping the function
-- avoids breaking historical migrations, while removing its direct API access
-- keeps every decision on the guarded automation path above.
revoke all on function public.change_application_status_as_owner(uuid, text, text)
  from public, anon, authenticated;

-- This is a trigger helper, not a client callable endpoint.
revoke all on function public.notify_community_application_received()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
