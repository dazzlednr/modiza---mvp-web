-- MODIZA meeting-first operating model.
-- Additive only: existing communities, schedules, applications, and demo data are untouched.

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  source_meeting_id uuid references public.meetings(id) on delete set null,
  slug text not null unique,
  title text not null default '새 모임',
  short_description text not null default '',
  description text not null default '',
  image_url text,
  event_date date,
  start_time time,
  end_time time,
  location text,
  location_is_undecided boolean not null default true,
  capacity integer,
  participation_fee integer not null default 0,
  preparation_items text not null default '',
  recruitment_start_at timestamptz,
  recruitment_end_at timestamptz,
  status text not null default 'draft',
  visibility text not null default 'discover',
  participant_eligibility text not null default 'anyone',
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_title_length_check check (char_length(btrim(title)) between 1 and 100),
  constraint meetings_capacity_check check (capacity is null or capacity > 0),
  constraint meetings_participation_fee_check check (participation_fee >= 0),
  constraint meetings_time_order_check check (start_time is null or end_time is null or end_time > start_time),
  constraint meetings_recruitment_window_check check (
    recruitment_start_at is null or recruitment_end_at is null or recruitment_end_at > recruitment_start_at
  ),
  constraint meetings_status_check check (status in ('draft', 'recruiting', 'closed', 'completed', 'cancelled')),
  constraint meetings_visibility_check check (visibility in ('discover', 'link_only')),
  constraint meetings_eligibility_check check (participant_eligibility in ('anyone', 'community_members')),
  constraint meetings_community_eligibility_check check (
    participant_eligibility <> 'community_members' or community_id is not null
  ),
  constraint meetings_publication_ready_check check (
    status in ('draft', 'cancelled')
    or (
      char_length(btrim(title)) >= 2
      and event_date is not null
      and start_time is not null
      and end_time is not null
      and capacity is not null
      and capacity > 0
    )
  )
);

comment on table public.meetings is 'Independent operating unit for standalone and community-linked meetings.';
comment on column public.meetings.community_id is 'Optional community relationship; ownership is still direct through owner_id.';
comment on column public.meetings.visibility is 'discover appears in MODIZA discovery; link_only is omitted from discovery but remains reachable by URL.';
comment on column public.meetings.participant_eligibility is 'community_members is schema-ready; application enforcement is handled in a later phase.';
comment on column public.meetings.source_meeting_id is 'Provenance for duplicated meetings. Operational result data is never copied.';

create index meetings_owner_updated_idx on public.meetings(owner_id, updated_at desc);
create index meetings_community_date_idx on public.meetings(community_id, event_date);
create index meetings_public_discovery_idx on public.meetings(status, visibility, event_date)
  where status in ('recruiting', 'closed', 'completed');
create index meetings_source_idx on public.meetings(source_meeting_id)
  where source_meeting_id is not null;

create trigger meetings_updated
  before update on public.meetings
  for each row execute function public.set_updated_at();

create or replace function public.enforce_meeting_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status in ('recruiting', 'cancelled'))
    or (old.status = 'recruiting' and new.status in ('closed', 'completed', 'cancelled'))
    or (old.status = 'closed' and new.status in ('recruiting', 'completed', 'cancelled'))
  ) then
    raise exception 'INVALID_MEETING_STATUS_TRANSITION: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  new.status_changed_at = now();
  return new;
end;
$$;

create trigger meetings_status_transition
  before update of status on public.meetings
  for each row execute function public.enforce_meeting_status_transition();

alter table public.meetings enable row level security;

create policy "public meetings or owned drafts are readable"
  on public.meetings for select
  to anon, authenticated
  using (
    status in ('recruiting', 'closed', 'completed')
    or owner_id = (select auth.uid())
  );

create policy "community hosts create owned meetings"
  on public.meetings for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      public.current_user_has_role('community_host')
      or public.current_user_has_role('admin')
    )
    and (
      community_id is null
      or exists (
        select 1
        from public.communities
        where communities.id = meetings.community_id
          and communities.owner_id = (select auth.uid())
      )
    )
  );

create policy "community hosts update owned meetings"
  on public.meetings for update
  to authenticated
  using (
    owner_id = (select auth.uid())
    and (
      public.current_user_has_role('community_host')
      or public.current_user_has_role('admin')
    )
  )
  with check (
    owner_id = (select auth.uid())
    and (
      public.current_user_has_role('community_host')
      or public.current_user_has_role('admin')
    )
    and (
      community_id is null
      or exists (
        select 1
        from public.communities
        where communities.id = meetings.community_id
          and communities.owner_id = (select auth.uid())
      )
    )
  );

create policy "community hosts delete owned draft meetings"
  on public.meetings for delete
  to authenticated
  using (
    owner_id = (select auth.uid())
    and status = 'draft'
    and (
      public.current_user_has_role('community_host')
      or public.current_user_has_role('admin')
    )
  );

-- New projects may not expose SQL-created tables automatically. Grants and RLS are both explicit.
revoke all on table public.meetings from anon, authenticated;
grant select (
  id, community_id, slug, title, short_description, description, image_url,
  event_date, start_time, end_time, location, location_is_undecided, capacity,
  participation_fee, preparation_items, recruitment_start_at, recruitment_end_at,
  status, visibility, participant_eligibility, created_at, updated_at
) on table public.meetings to anon;
grant select, insert, update, delete on table public.meetings to authenticated;
grant all on table public.meetings to service_role;
