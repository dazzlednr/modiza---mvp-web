-- Space-use requests and private negotiation contacts.
-- Public space rows never expose negotiation contact values.

alter table public.space_host_applications
  add column if not exists negotiation_contact_method text,
  add column if not exists negotiation_contact_value text;

update public.space_host_applications
set negotiation_contact_method = coalesce(negotiation_contact_method, 'other'),
    negotiation_contact_value = coalesce(negotiation_contact_value, phone)
where negotiation_contact_value is null
  and coalesce(phone, '') <> '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'space_host_applications_negotiation_contact_method_check'
  ) then
    alter table public.space_host_applications
      add constraint space_host_applications_negotiation_contact_method_check
      check (
        negotiation_contact_method is null
        or negotiation_contact_method in (
          'store_phone', 'kakao_open_chat', 'kakao_channel', 'instagram', 'other'
        )
      ) not valid;
  end if;
end
$$;

create table if not exists public.space_contact_settings (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  use_host_contact boolean not null default true,
  contact_method text,
  contact_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    contact_method is null
    or contact_method in (
      'store_phone', 'kakao_open_chat', 'kakao_channel', 'instagram', 'other'
    )
  ),
  check (
    use_host_contact
    or (
      coalesce(trim(contact_method), '') <> ''
      and coalesce(trim(contact_value), '') <> ''
    )
  )
);

insert into public.space_contact_settings (
  space_id, owner_id, use_host_contact, contact_method, contact_value
)
select id, owner_id, false, preferred_contact_method, private_contact
from public.spaces
where owner_id is not null
  and coalesce(trim(private_contact), '') <> ''
on conflict (space_id) do nothing;

-- Legacy public-row contact columns remain for schema compatibility but are
-- cleared after being copied to the private table.
update public.spaces
set preferred_contact_method = null,
    private_contact = null
where private_contact is not null
   or preferred_contact_method is not null;

create table if not exists public.space_use_requests (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  space_owner_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  requested_date date not null,
  requested_start_time time not null,
  requested_end_time time not null,
  expected_attendees integer not null check (expected_attendees > 0),
  message text,
  owner_memo text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'confirmed', 'cancelled')),
  approved_at timestamptz,
  rejected_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists space_use_requests_space_owner_idx
  on public.space_use_requests(space_owner_id, status, created_at desc);
create index if not exists space_use_requests_requester_idx
  on public.space_use_requests(requester_id, created_at desc);
create index if not exists space_use_requests_space_idx
  on public.space_use_requests(space_id, requested_date);
create index if not exists space_use_requests_community_idx
  on public.space_use_requests(community_id, created_at desc);

drop trigger if exists space_contact_settings_updated on public.space_contact_settings;
create trigger space_contact_settings_updated
before update on public.space_contact_settings
for each row execute function public.set_updated_at();

drop trigger if exists space_use_requests_updated on public.space_use_requests;
create trigger space_use_requests_updated
before update on public.space_use_requests
for each row execute function public.set_updated_at();

alter table public.space_contact_settings enable row level security;
alter table public.space_use_requests enable row level security;

drop policy if exists "space owners manage private contact settings"
  on public.space_contact_settings;
create policy "space owners manage private contact settings"
on public.space_contact_settings for all to authenticated
using (owner_id = auth.uid() or public.current_user_is_admin())
with check (
  (owner_id = auth.uid() and exists (
    select 1 from public.spaces s
    where s.id = space_id and s.owner_id = auth.uid()
  ))
  or public.current_user_is_admin()
);

drop policy if exists "request participants read space use requests"
  on public.space_use_requests;
create policy "request participants read space use requests"
on public.space_use_requests for select to authenticated
using (
  requester_id = auth.uid()
  or space_owner_id = auth.uid()
  or public.current_user_is_admin()
);

revoke all on public.space_contact_settings from anon;
revoke all on public.space_use_requests from anon;
grant select, insert, update, delete on public.space_contact_settings to authenticated;
grant select on public.space_use_requests to authenticated;
revoke insert, update, delete on public.space_use_requests from authenticated;
grant all on public.space_contact_settings, public.space_use_requests to service_role;

create or replace function public.create_space_use_request(
  p_space_id uuid,
  p_community_id uuid,
  p_purpose text,
  p_requested_date date,
  p_requested_start_time time,
  p_requested_end_time time,
  p_expected_attendees integer,
  p_message text,
  p_idempotency_key uuid
)
returns public.space_use_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  community_row public.communities;
  space_row public.spaces;
  request_row public.space_use_requests;
begin
  if not public.current_user_has_role('community_host') then
    raise exception 'COMMUNITY_HOST_REQUIRED' using errcode = '42501';
  end if;

  select * into community_row
  from public.communities
  where id = p_community_id and owner_id = auth.uid();
  if community_row.id is null then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into space_row
  from public.spaces
  where id = p_space_id and status = 'approved';
  if space_row.id is null or space_row.owner_id is null then
    raise exception 'SPACE_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  if space_row.owner_id = auth.uid() then
    raise exception 'OWN_SPACE_REQUEST_NOT_ALLOWED' using errcode = '22023';
  end if;
  if p_expected_attendees < 1 or p_expected_attendees > space_row.max_capacity then
    raise exception 'INVALID_ATTENDEE_COUNT' using errcode = '22023';
  end if;
  if p_requested_end_time <= p_requested_start_time then
    raise exception 'INVALID_REQUEST_TIME' using errcode = '22023';
  end if;
  if coalesce(trim(p_purpose), '') = '' then
    raise exception 'PURPOSE_REQUIRED' using errcode = '22023';
  end if;

  select * into request_row
  from public.space_use_requests
  where idempotency_key = p_idempotency_key;
  if request_row.id is not null then return request_row; end if;

  insert into public.space_use_requests (
    space_id, community_id, requester_id, space_owner_id, purpose,
    requested_date, requested_start_time, requested_end_time,
    expected_attendees, message, idempotency_key
  )
  values (
    space_row.id, community_row.id, auth.uid(), space_row.owner_id, trim(p_purpose),
    p_requested_date, p_requested_start_time, p_requested_end_time,
    p_expected_attendees, nullif(trim(p_message), ''), p_idempotency_key
  )
  returning * into request_row;

  insert into public.notifications (
    user_id, type, title, message, link, related_community_id, idempotency_key
  )
  values (
    space_row.owner_id,
    'space_use_request_received',
    '새로운 공간 이용 요청이 도착했어요',
    community_row.name || '에서 ' || space_row.name || ' 이용을 요청했습니다.',
    '/dashboard/spaces/requests?requestId=' || request_row.id,
    community_row.id,
    'space-use-request-received:' || request_row.id
  )
  on conflict (idempotency_key) do nothing;

  return request_row;
end
$$;

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

  update public.space_use_requests
  set status = p_status,
      owner_memo = nullif(trim(p_owner_memo), ''),
      approved_at = case when p_status = 'approved' then now() else null end,
      rejected_at = case when p_status = 'rejected' then now() else null end
  where id = request_row.id
  returning * into request_row;

  select * into community_row from public.communities where id = request_row.community_id;
  select * into space_row from public.spaces where id = request_row.space_id;

  insert into public.notifications (
    user_id, type, title, message, link, related_community_id, idempotency_key
  )
  values (
    request_row.requester_id,
    'space_use_request_' || p_status,
    case
      when p_status = 'approved' then '공간 이용 요청이 승인되었어요'
      else '공간 이용 요청 결과를 확인해주세요'
    end,
    space_row.name || case
      when p_status = 'approved'
        then ' 이용 요청이 승인되었습니다. 협의 연락처를 확인해주세요.'
      else ' 이용 요청이 승인되지 않았습니다.'
    end,
    '/dashboard/communities/space-requests?requestId=' || request_row.id,
    community_row.id,
    'space-use-request-result:' || request_row.id || ':' || p_status
  )
  on conflict (idempotency_key) do nothing;

  return request_row;
end
$$;

create or replace function public.confirm_space_use_request(p_request_id uuid)
returns public.space_use_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.space_use_requests;
  community_row public.communities;
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
  if request_row.status <> 'approved' then
    raise exception 'APPROVAL_REQUIRED' using errcode = '22023';
  end if;

  update public.space_use_requests
  set status = 'confirmed', confirmed_at = now()
  where id = request_row.id
  returning * into request_row;

  select * into community_row from public.communities where id = request_row.community_id;
  update public.communities
  set linked_space_id = request_row.space_id,
      space_id = request_row.space_id
  where id = request_row.community_id
    and owner_id = request_row.requester_id;
  insert into public.notifications (
    user_id, type, title, message, link, related_community_id, idempotency_key
  )
  values (
    request_row.space_owner_id,
    'space_use_request_confirmed',
    '공간 이용 일정이 확정되었어요',
    community_row.name || ' 운영자가 협의한 이용 일정을 확정했습니다.',
    '/dashboard/spaces/requests?requestId=' || request_row.id,
    community_row.id,
    'space-use-request-confirmed:' || request_row.id
  )
  on conflict (idempotency_key) do nothing;

  return request_row;
end
$$;

revoke all on function public.create_space_use_request(
  uuid, uuid, text, date, time, time, integer, text, uuid
) from public, anon;
revoke all on function public.respond_space_use_request(uuid, text, text)
  from public, anon;
revoke all on function public.confirm_space_use_request(uuid)
  from public, anon;
grant execute on function public.create_space_use_request(
  uuid, uuid, text, date, time, time, integer, text, uuid
) to authenticated;
grant execute on function public.respond_space_use_request(uuid, text, text)
  to authenticated;
grant execute on function public.confirm_space_use_request(uuid)
  to authenticated;

notify pgrst, 'reload schema';
