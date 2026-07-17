-- MODIZA in-app notifications and protected community open-chat links.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  related_community_id uuid references public.communities(id) on delete cascade,
  related_application_id uuid references public.community_applications(id) on delete cascade,
  idempotency_key text unique,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.community_open_chats (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null unique references public.communities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  open_chat_url text not null check (open_chat_url ~ '^https://open\.kakao\.com/'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists notifications_user_unread_idx on public.notifications(user_id,is_read);
create index if not exists notifications_created_idx on public.notifications(created_at desc);
create index if not exists notifications_community_idx on public.notifications(related_community_id);
create index if not exists notifications_application_idx on public.notifications(related_application_id);
create index if not exists community_open_chats_owner_idx on public.community_open_chats(owner_id);

drop trigger if exists community_open_chats_updated on public.community_open_chats;
create trigger community_open_chats_updated before update on public.community_open_chats
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.community_open_chats enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id=auth.uid());
create policy "users update own notifications" on public.notifications
  for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "authorized users read community open chat" on public.community_open_chats;
drop policy if exists "owners insert community open chat" on public.community_open_chats;
drop policy if exists "owners update community open chat" on public.community_open_chats;
drop policy if exists "owners delete community open chat" on public.community_open_chats;
create policy "authorized users read community open chat" on public.community_open_chats
  for select to authenticated using (
    owner_id=auth.uid() or exists (
      select 1 from public.community_applications a
      where a.community_id=community_open_chats.community_id
        and a.applicant_user_id=auth.uid() and a.status='approved'
    )
  );
create policy "owners insert community open chat" on public.community_open_chats
  for insert to authenticated with check (
    owner_id=auth.uid() and exists (
      select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()
    )
  );
create policy "owners update community open chat" on public.community_open_chats
  for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
create policy "owners delete community open chat" on public.community_open_chats
  for delete to authenticated using (owner_id=auth.uid());

revoke insert,delete on public.notifications from anon,authenticated;
grant select,update on public.notifications to authenticated;
grant select,insert,update,delete on public.community_open_chats to authenticated;
grant all on public.notifications,public.community_open_chats to service_role;

create or replace function public.notify_community_application_received()
returns trigger language plpgsql security definer set search_path=''
as $$
declare c public.communities;
begin
  select * into c from public.communities where id=new.community_id;
  if c.owner_id is not null then
    insert into public.notifications(user_id,type,title,message,link,related_community_id,related_application_id,idempotency_key)
    values(c.owner_id,'community_application_received','새로운 참가 신청이 도착했어요',
      new.applicant_name||'님이 '||c.name||'에 참가를 신청했습니다.',
      '/dashboard/applications?communityId='||c.id,new.community_id,new.id,'application-received:'||new.id)
    on conflict(idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_community_application_received on public.community_applications;
create trigger notify_community_application_received after insert on public.community_applications
for each row execute function public.notify_community_application_received();

create or replace function public.change_application_status_as_owner(
  p_application_id uuid, p_status text, p_operator_memo text default null
)
returns public.community_applications
language plpgsql security definer set search_path=''
as $$
declare application_row public.community_applications;
declare previous_status text;
declare community_row public.communities;
declare chat_exists boolean;
begin
  if p_status not in ('pending','approved','rejected') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
  select * into application_row from public.community_applications where id=p_application_id for update;
  if application_row.id is null then raise exception 'APPLICATION_NOT_FOUND' using errcode='P0002'; end if;
  if application_row.status='cancelled' then raise exception 'CANCELLED_APPLICATION_IS_FINAL' using errcode='22023'; end if;
  select * into community_row from public.communities where id=application_row.community_id for update;
  if community_row.owner_id is distinct from auth.uid() or not public.current_user_has_role('community_host') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  previous_status:=application_row.status;
  if previous_status<>'approved' and p_status='approved' then
    if community_row.current_members>=community_row.capacity then raise exception 'CAPACITY_FULL' using errcode='P0001'; end if;
    update public.communities set current_members=current_members+1 where id=community_row.id;
  elsif previous_status='approved' and p_status<>'approved' then
    update public.communities set current_members=greatest(current_members-1,0) where id=community_row.id;
  end if;
  update public.community_applications set status=p_status,operator_memo=p_operator_memo
    where id=p_application_id returning * into application_row;

  if application_row.applicant_user_id is not null and previous_status is distinct from p_status then
    if p_status='approved' then
      select exists(select 1 from public.community_open_chats where community_id=community_row.id) into chat_exists;
      insert into public.notifications(user_id,type,title,message,link,related_community_id,related_application_id,idempotency_key)
      values(application_row.applicant_user_id,'community_application_approved','커뮤니티 참가가 확정되었어요 🎉',
        community_row.name||case when chat_exists then ' 참가가 확정되었습니다. 오픈채팅방을 확인해주세요.' else ' 참가가 확정되었습니다. 운영자가 오픈채팅방을 준비하고 있어요.' end,
        '/mypage/applications/'||application_row.id,community_row.id,application_row.id,'application-approved:'||application_row.id)
      on conflict(idempotency_key) do nothing;
    elsif p_status='rejected' then
      insert into public.notifications(user_id,type,title,message,link,related_community_id,related_application_id,idempotency_key)
      values(application_row.applicant_user_id,'community_application_rejected','커뮤니티 신청 결과를 확인해주세요',
        community_row.name||' 참가 신청이 승인되지 않았습니다.',
        '/mypage/applications/'||application_row.id,community_row.id,application_row.id,'application-rejected:'||application_row.id)
      on conflict(idempotency_key) do nothing;
    end if;
  end if;
  return application_row;
end;
$$;

create or replace function public.save_community_open_chat(p_community_id uuid,p_open_chat_url text)
returns public.community_open_chats
language plpgsql security definer set search_path=''
as $$
declare c public.communities; declare chat public.community_open_chats; declare was_missing boolean;
begin
  select * into c from public.communities where id=p_community_id for update;
  if c.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  if c.owner_id is distinct from auth.uid() or not public.current_user_has_role('community_host') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if trim(p_open_chat_url) !~ '^https://open\.kakao\.com/' then raise exception 'INVALID_OPEN_CHAT_URL' using errcode='22023'; end if;
  select not exists(select 1 from public.community_open_chats where community_id=p_community_id) into was_missing;
  insert into public.community_open_chats(community_id,owner_id,open_chat_url)
  values(p_community_id,auth.uid(),trim(p_open_chat_url))
  on conflict(community_id) do update set open_chat_url=excluded.open_chat_url,updated_at=now()
  returning * into chat;
  if was_missing then
    insert into public.notifications(user_id,type,title,message,link,related_community_id,related_application_id,idempotency_key)
    select a.applicant_user_id,'community_open_chat_registered','오픈채팅방이 등록되었어요',
      c.name||' 오픈채팅방에 입장할 수 있어요.','/mypage/applications/'||a.id,c.id,a.id,
      'open-chat-registered:'||chat.id||':'||a.id
    from public.community_applications a
    where a.community_id=c.id and a.status='approved' and a.applicant_user_id is not null
    on conflict(idempotency_key) do nothing;
  end if;
  return chat;
end;
$$;

create or replace function public.delete_community_open_chat(p_community_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not exists(select 1 from public.communities where id=p_community_id and owner_id=auth.uid()) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  delete from public.community_open_chats where community_id=p_community_id and owner_id=auth.uid();
end;
$$;

revoke all on function public.change_application_status_as_owner(uuid,text,text) from public,anon;
revoke all on function public.save_community_open_chat(uuid,text) from public,anon;
revoke all on function public.delete_community_open_chat(uuid) from public,anon;
grant execute on function public.change_application_status_as_owner(uuid,text,text) to authenticated;
grant execute on function public.save_community_open_chat(uuid,text) to authenticated;
grant execute on function public.delete_community_open_chat(uuid) to authenticated;

notify pgrst,'reload schema';
