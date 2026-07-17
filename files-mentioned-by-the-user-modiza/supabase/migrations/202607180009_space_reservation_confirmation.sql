alter table public.space_use_requests
  add column if not exists request_type text;

update public.space_use_requests r
set request_type = case
  when s.community_use_mode = 'request_consultation' then 'inquiry'
  else 'request'
end
from public.spaces s
where s.id = r.space_id
  and r.request_type is null;

alter table public.space_use_requests
  alter column request_type set default 'request',
  alter column request_type set not null;

alter table public.space_use_requests
  drop constraint if exists space_use_requests_request_type_check;

alter table public.space_use_requests
  add constraint space_use_requests_request_type_check
  check (request_type in ('inquiry', 'request'));

create or replace function public.set_space_use_request_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select case
    when s.community_use_mode = 'request_consultation' then 'inquiry'
    else 'request'
  end
  into new.request_type
  from public.spaces s
  where s.id = new.space_id;

  new.request_type := coalesce(new.request_type, 'request');
  return new;
end
$$;

drop trigger if exists space_use_requests_set_request_type
  on public.space_use_requests;
create trigger space_use_requests_set_request_type
before insert on public.space_use_requests
for each row execute function public.set_space_use_request_type();

create table if not exists public.space_reservations (
  id uuid primary key default gen_random_uuid(),
  usage_request_id uuid not null unique
    references public.space_use_requests(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  space_owner_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  reservation_date date not null,
  start_time time not null,
  end_time time not null,
  expected_people integer not null check (expected_people > 0),
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed')),
  owner_note text,
  confirmed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists space_reservations_space_schedule_idx
  on public.space_reservations(space_id, reservation_date, start_time, end_time)
  where status = 'confirmed';
create index if not exists space_reservations_owner_idx
  on public.space_reservations(space_owner_id, reservation_date desc);
create index if not exists space_reservations_requester_idx
  on public.space_reservations(requester_id, reservation_date desc);

drop trigger if exists space_reservations_updated on public.space_reservations;
create trigger space_reservations_updated
before update on public.space_reservations
for each row execute function public.set_updated_at();

alter table public.space_reservations enable row level security;

drop policy if exists "reservation participants read reservations"
  on public.space_reservations;
create policy "reservation participants read reservations"
on public.space_reservations for select to authenticated
using (
  requester_id = auth.uid()
  or space_owner_id = auth.uid()
  or public.current_user_is_admin()
);

revoke all on public.space_reservations from anon;
revoke insert, update, delete on public.space_reservations from authenticated;
grant select on public.space_reservations to authenticated;
grant all on public.space_reservations to service_role;

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
begin
  if p_status not in ('approved', 'rejected') then
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
  if request_row.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_PROCESSED' using errcode = '22023';
  end if;

  select * into community_row
  from public.communities
  where id = request_row.community_id;
  select * into space_row
  from public.spaces
  where id = request_row.space_id;

  if p_status = 'approved' then
    -- Serialize approvals for one space and date so simultaneous requests
    -- cannot both pass the overlap check.
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
        approved_at = now(),
        confirmed_at = now()
    where id = request_row.id
    returning * into request_row;

    update public.communities
    set linked_space_id = request_row.space_id,
        space_id = request_row.space_id
    where id = request_row.community_id
      and owner_id = request_row.requester_id;
  else
    update public.space_use_requests
    set status = 'rejected',
        owner_memo = nullif(trim(p_owner_memo), ''),
        rejected_at = now()
    where id = request_row.id
    returning * into request_row;
  end if;

  insert into public.notifications (
    user_id, type, title, message, link, related_community_id, idempotency_key
  )
  values (
    request_row.requester_id,
    case when p_status = 'approved'
      then 'space_reservation_confirmed'
      else 'space_use_request_rejected'
    end,
    case when p_status = 'approved'
      then '공간 예약이 확정되었어요'
      else '공간 이용 요청 결과를 확인해주세요'
    end,
    case when p_status = 'approved'
      then space_row.name || ' 예약이 확정되었습니다.'
      else space_row.name || ' 이용 요청이 승인되지 않았습니다.'
    end,
    '/dashboard/communities/space-requests?requestId=' || request_row.id,
    community_row.id,
    'space-use-request-result:' || request_row.id || ':' || p_status
  )
  on conflict (idempotency_key) do nothing;

  return request_row;
end
$$;

-- Backward compatibility for clients that still call the old confirmation
-- action after an approval made before this migration.
create or replace function public.confirm_space_use_request(p_request_id uuid)
returns public.space_use_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.space_use_requests;
begin
  select * into request_row
  from public.space_use_requests
  where id = p_request_id
  for update;

  if request_row.id is null then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if request_row.requester_id <> auth.uid()
     or not public.current_user_has_role('community_host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if request_row.status = 'confirmed' then
    return request_row;
  end if;
  if request_row.status <> 'approved' then
    raise exception 'SPACE_OWNER_APPROVAL_REQUIRED' using errcode = '22023';
  end if;

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
    'confirmed', request_row.owner_memo, now()
  )
  on conflict (usage_request_id) do nothing;

  update public.space_use_requests
  set status = 'confirmed', confirmed_at = now()
  where id = request_row.id
  returning * into request_row;

  update public.communities
  set linked_space_id = request_row.space_id,
      space_id = request_row.space_id
  where id = request_row.community_id
    and owner_id = request_row.requester_id;

  return request_row;
end
$$;

revoke all on function public.respond_space_use_request(uuid, text, text)
  from public, anon;
revoke all on function public.confirm_space_use_request(uuid)
  from public, anon;
grant execute on function public.respond_space_use_request(uuid, text, text)
  to authenticated;
grant execute on function public.confirm_space_use_request(uuid)
  to authenticated;

notify pgrst, 'reload schema';
