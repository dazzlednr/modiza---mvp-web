-- Repairs missing application decision notifications and makes approval
-- processing idempotent even when an application was already approved.

-- Remove accidental duplicate decision notifications before adding the
-- application-scoped uniqueness rule.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, type, related_application_id
      order by created_at, id
    ) as duplicate_order
  from public.notifications
  where related_application_id is not null
    and type in ('community_application_approved', 'community_application_rejected')
)
delete from public.notifications
where id in (select id from ranked where duplicate_order > 1);

create unique index if not exists notifications_application_decision_unique
  on public.notifications(user_id, type, related_application_id)
  where related_application_id is not null
    and type in ('community_application_approved', 'community_application_rejected');

-- The client passes only the application ID and desired state. The function
-- derives the operator, owner, applicant and notification recipient itself.
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
  if p_status not in ('pending', 'approved', 'rejected') then
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

  if previous_status <> 'approved' and p_status = 'approved' then
    if community_row.current_members >= community_row.capacity then
      raise exception 'CAPACITY_FULL' using errcode = 'P0001';
    end if;
    update public.communities
      set current_members = current_members + 1
    where id = community_row.id;
  elsif previous_status = 'approved' and p_status <> 'approved' then
    update public.communities
      set current_members = greatest(current_members - 1, 0)
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

  -- This runs even if the row was already approved. The unique index makes
  -- the operation idempotent while repairing a previously missing alert.
  if p_status = 'approved' and application_row.applicant_user_id is not null then
    insert into public.notifications(
      user_id,
      type,
      title,
      message,
      link,
      related_community_id,
      related_application_id,
      idempotency_key
    )
    values(
      application_row.applicant_user_id,
      'community_application_approved',
      '커뮤니티 참가가 확정되었어요 🎉',
      community_row.name ||
        case
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
      user_id,
      type,
      title,
      message,
      link,
      related_community_id,
      related_application_id,
      idempotency_key
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

-- Keep open-chat registration atomic and exclude an owner who may still have
-- a legacy self-application row.
create or replace function public.save_community_open_chat(
  p_community_id uuid,
  p_open_chat_url text
)
returns public.community_open_chats
language plpgsql
security definer
set search_path = ''
as $$
declare
  community_row public.communities;
  chat_row public.community_open_chats;
  was_missing boolean;
begin
  select * into community_row
  from public.communities
  where id = p_community_id
  for update;

  if community_row.id is null then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if community_row.owner_id is distinct from auth.uid()
    or not public.current_user_has_role('community_host') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if trim(p_open_chat_url) !~ '^https://open\.kakao\.com/' then
    raise exception 'INVALID_OPEN_CHAT_URL' using errcode = '22023';
  end if;

  select not exists(
    select 1 from public.community_open_chats where community_id = p_community_id
  ) into was_missing;

  insert into public.community_open_chats(community_id, owner_id, open_chat_url)
  values(p_community_id, auth.uid(), trim(p_open_chat_url))
  on conflict(community_id) do update
    set open_chat_url = excluded.open_chat_url,
        updated_at = now()
  returning * into chat_row;

  if was_missing then
    insert into public.notifications(
      user_id,
      type,
      title,
      message,
      link,
      related_community_id,
      related_application_id,
      idempotency_key
    )
    select
      application.applicant_user_id,
      'community_open_chat_registered',
      '오픈채팅방이 등록되었어요',
      community_row.name || ' 오픈채팅방에 입장할 수 있어요.',
      '/mypage/applications/' || application.id,
      community_row.id,
      application.id,
      'open-chat-registered:' || chat_row.id || ':' || application.id
    from public.community_applications application
    where application.community_id = community_row.id
      and application.status = 'approved'
      and application.applicant_user_id is not null
      and application.applicant_user_id is distinct from community_row.owner_id
    on conflict(idempotency_key) do nothing;
  end if;

  return chat_row;
end;
$$;

revoke all on function public.save_community_open_chat(uuid, text)
  from public, anon;
grant execute on function public.save_community_open_chat(uuid, text)
  to authenticated;

-- Backfill only authenticated, already-approved applications that are missing
-- their approval notification. Legacy seed rows without applicant_user_id are
-- intentionally excluded because they are not tied to a login account.
insert into public.notifications(
  user_id,
  type,
  title,
  message,
  link,
  related_community_id,
  related_application_id,
  idempotency_key
)
select
  application.applicant_user_id,
  'community_application_approved',
  '커뮤니티 참가가 확정되었어요 🎉',
  community.name ||
    case
      when open_chat.community_id is not null then ' 참가가 확정되었습니다. 오픈채팅방을 확인해주세요.'
      else ' 참가가 확정되었습니다. 운영자가 오픈채팅방을 준비하고 있어요.'
    end,
  '/mypage/applications/' || application.id,
  community.id,
  application.id,
  'application-approved:' || application.id
from public.community_applications application
join public.communities community on community.id = application.community_id
left join public.community_open_chats open_chat on open_chat.community_id = community.id
where application.status = 'approved'
  and application.applicant_user_id is not null
on conflict do nothing;

-- Reassert account-isolated policies and client privileges.
alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, delete on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

notify pgrst, 'reload schema';
