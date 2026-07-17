-- Add an explicit negotiation state and deliver owner memo changes to the
-- community host without changing existing request or reservation history.

alter table public.space_use_requests
  add column if not exists memo_updated_at timestamptz;

alter table public.space_use_requests
  drop constraint if exists space_use_requests_status_check;
alter table public.space_use_requests
  add constraint space_use_requests_status_check
  check (status in (
    'pending', 'negotiating', 'approved', 'rejected', 'confirmed', 'cancelled'
  ));

create or replace function public.respond_space_use_request(
  p_request_id uuid,
  p_status text,
  p_owner_memo text default null
)
returns public.space_use_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.space_use_requests;
  community_row public.communities;
  space_row public.spaces;
  notification_title text;
  notification_message text;
begin
  if p_status not in ('negotiating', 'approved', 'rejected') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  select * into request_row
  from public.space_use_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.space_owner_id <> auth.uid()
     or not public.current_user_has_role('space_host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if request_row.status not in ('pending', 'negotiating') then
    raise exception 'REQUEST_ALREADY_PROCESSED' using errcode = '22023';
  end if;

  select * into community_row
  from public.communities
  where id = request_row.community_id;
  select * into space_row
  from public.spaces
  where id = request_row.space_id;

  if p_status = 'approved' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        request_row.space_id::text || ':' || request_row.requested_date::text,
        0
      )
    );

    if exists (
      select 1
      from public.space_reservations reservation
      where reservation.space_id = request_row.space_id
        and reservation.reservation_date = request_row.requested_date
        and reservation.status = 'confirmed'
        and reservation.start_time < request_row.requested_end_time
        and reservation.end_time > request_row.requested_start_time
    ) then
      raise exception 'RESERVATION_TIME_CONFLICT' using errcode = '23P01';
    end if;

    insert into public.space_reservations (
      usage_request_id, space_id, community_id, space_owner_id, requester_id,
      reservation_date, start_time, end_time, expected_people,
      status, owner_note, confirmed_at
    )
    values (
      request_row.id, request_row.space_id, request_row.community_id,
      request_row.space_owner_id, request_row.requester_id,
      request_row.requested_date, request_row.requested_start_time,
      request_row.requested_end_time, request_row.expected_attendees,
      'confirmed', nullif(trim(p_owner_memo), ''), now()
    );

    update public.space_use_requests
    set status = 'confirmed',
        owner_memo = nullif(trim(p_owner_memo), ''),
        memo_updated_at = case when p_owner_memo is not null then now() else memo_updated_at end,
        approved_at = now(),
        confirmed_at = now()
    where id = request_row.id
    returning * into request_row;

    update public.communities
    set linked_space_id = request_row.space_id,
        space_id = request_row.space_id
    where id = request_row.community_id
      and owner_id = request_row.requester_id;

    notification_title := '공간 예약이 확정되었어요';
    notification_message := space_row.name || ' 예약이 확정되었습니다.';
  elsif p_status = 'negotiating' then
    update public.space_use_requests
    set status = 'negotiating',
        owner_memo = nullif(trim(p_owner_memo), ''),
        memo_updated_at = now()
    where id = request_row.id
    returning * into request_row;

    notification_title := '공간 운영자가 협의를 요청했어요';
    notification_message := coalesce(
      nullif(trim(p_owner_memo), ''),
      space_row.name || ' 이용 조건을 확인해주세요.'
    );
  else
    update public.space_use_requests
    set status = 'rejected',
        owner_memo = nullif(trim(p_owner_memo), ''),
        memo_updated_at = case when p_owner_memo is not null then now() else memo_updated_at end,
        rejected_at = now()
    where id = request_row.id
    returning * into request_row;

    notification_title := '공간 이용 요청 결과를 확인해주세요';
    notification_message := coalesce(
      nullif(trim(p_owner_memo), ''),
      space_row.name || ' 이용 요청이 거절되었습니다.'
    );
  end if;

  insert into public.notifications (
    user_id, type, title, message, link, related_community_id, idempotency_key
  )
  values (
    request_row.requester_id,
    case p_status
      when 'approved' then 'space_reservation_confirmed'
      when 'negotiating' then 'space_use_request_negotiating'
      else 'space_use_request_rejected'
    end,
    notification_title,
    notification_message,
    '/dashboard/communities/space-requests?requestId=' || request_row.id,
    community_row.id,
    'space-use-request-result:' || request_row.id || ':' || p_status
  )
  on conflict (idempotency_key) do update
  set title = excluded.title,
      message = excluded.message,
      created_at = now(),
      is_read = false,
      read_at = null;

  return request_row;
end
$$;

create or replace function public.update_space_use_request_memo(
  p_request_id uuid,
  p_owner_memo text default null
)
returns public.space_use_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.space_use_requests;
  space_row public.spaces;
begin
  select * into request_row
  from public.space_use_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.space_owner_id <> auth.uid()
     or not public.current_user_has_role('space_host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.space_use_requests
  set owner_memo = nullif(trim(p_owner_memo), ''),
      memo_updated_at = now()
  where id = request_row.id
  returning * into request_row;

  select * into space_row from public.spaces where id = request_row.space_id;

  insert into public.notifications (
    user_id, type, title, message, link, related_community_id, idempotency_key
  )
  values (
    request_row.requester_id,
    'space_use_request_memo_updated',
    '공간 운영자 메시지가 도착했어요',
    coalesce(
      nullif(trim(p_owner_memo), ''),
      space_row.name || ' 요청의 운영자 메시지가 수정되었습니다.'
    ),
    '/dashboard/communities/space-requests?requestId=' || request_row.id,
    request_row.community_id,
    'space-use-request-memo:' || request_row.id || ':' ||
      extract(epoch from pg_catalog.clock_timestamp())::text
  );

  return request_row;
end
$$;

revoke all on function public.respond_space_use_request(uuid, text, text)
  from public, anon;
revoke all on function public.update_space_use_request_memo(uuid, text)
  from public, anon;
grant execute on function public.respond_space_use_request(uuid, text, text)
  to authenticated;
grant execute on function public.update_space_use_request_memo(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
