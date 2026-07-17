-- Community host onboarding, public host profile, and community activity gallery.
-- Community hosts are self-service. Space-host verification remains unchanged.

create table if not exists public.community_host_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  profile_image_url text,
  headline text not null check (char_length(trim(headline)) between 2 and 120),
  introduction text not null check (char_length(trim(introduction)) between 10 and 1000),
  activity_region text not null,
  interest_categories text[] not null default '{}'::text[],
  operating_styles text[] not null default '{}'::text[],
  social_url text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communities
  add column if not exists meeting_frequency_type text not null default 'one_time',
  add column if not exists meeting_frequency_label text,
  add column if not exists recommended_for text[] not null default '{}'::text[],
  add column if not exists participation_notices text[] not null default '{}'::text[],
  add column if not exists duration_minutes integer;

alter table public.communities drop constraint if exists communities_meeting_frequency_type_check;
alter table public.communities add constraint communities_meeting_frequency_type_check
  check (meeting_frequency_type in ('one_time','weekly','biweekly','monthly','custom'));
alter table public.communities drop constraint if exists communities_duration_minutes_check;
alter table public.communities add constraint communities_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 30 and 1440);

update public.communities
set duration_minutes = greatest(30, least(1440, round(coalesce(expected_duration_hours, 2) * 60)::integer))
where duration_minutes is null;

create table if not exists public.community_activity_images (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  file_name text,
  mime_type text,
  file_size integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_activity_images_community_sort_idx
  on public.community_activity_images(community_id, sort_order, created_at);

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='community_host_profiles_updated') then
    create trigger community_host_profiles_updated before update on public.community_host_profiles
      for each row execute function public.set_updated_at();
  end if;
  if not exists(select 1 from pg_trigger where tgname='community_activity_images_updated') then
    create trigger community_activity_images_updated before update on public.community_activity_images
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.community_host_profiles enable row level security;
alter table public.community_activity_images enable row level security;

drop policy if exists "public reads active community host profiles" on public.community_host_profiles;
drop policy if exists "users manage own community host profile" on public.community_host_profiles;
create policy "public reads active community host profiles" on public.community_host_profiles
  for select to anon,authenticated using (
    user_id=auth.uid() or exists(
      select 1 from public.communities c
      where c.owner_id=user_id and c.status='published' and c.deleted_at is null
    )
  );
create policy "users manage own community host profile" on public.community_host_profiles
  for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists "public reads published community activity images" on public.community_activity_images;
drop policy if exists "owners manage community activity images" on public.community_activity_images;
create policy "public reads published community activity images" on public.community_activity_images
  for select to anon,authenticated using(exists(
    select 1 from public.communities c
    where c.id=community_id and (c.status='published' or c.owner_id=auth.uid()) and c.deleted_at is null
  ));
create policy "owners manage community activity images" on public.community_activity_images
  for all to authenticated using(exists(
    select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()
  )) with check(exists(
    select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()
  ));

grant select on public.community_host_profiles,public.community_activity_images to anon,authenticated;
grant insert,update,delete on public.community_host_profiles,public.community_activity_images to authenticated;
grant all on public.community_host_profiles,public.community_activity_images to service_role;

-- Profile and role are committed together; a failed profile write never leaves a half-created role.
create or replace function public.start_community_host(
  p_display_name text,
  p_profile_image_url text,
  p_headline text,
  p_introduction text,
  p_activity_region text,
  p_interest_categories text[],
  p_operating_styles text[],
  p_social_url text default null
) returns public.community_host_profiles
language plpgsql security definer set search_path=''
as $$
declare result public.community_host_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.current_user_is_active() then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501'; end if;
  insert into public.community_host_profiles(
    user_id,display_name,profile_image_url,headline,introduction,activity_region,
    interest_categories,operating_styles,social_url
  ) values(
    auth.uid(),trim(p_display_name),nullif(trim(p_profile_image_url),''),trim(p_headline),
    trim(p_introduction),trim(p_activity_region),coalesce(p_interest_categories,'{}'),
    coalesce(p_operating_styles,'{}'),nullif(trim(p_social_url),'')
  ) on conflict(user_id) do update set
    display_name=excluded.display_name,profile_image_url=excluded.profile_image_url,
    headline=excluded.headline,introduction=excluded.introduction,activity_region=excluded.activity_region,
    interest_categories=excluded.interest_categories,operating_styles=excluded.operating_styles,
    social_url=excluded.social_url
  returning * into result;
  update public.profiles
    set roles=public.normalize_profile_roles(roles || array['community_host']::text[])
    where id=auth.uid();
  return result;
end $$;
revoke all on function public.start_community_host(text,text,text,text,text,text[],text[],text) from public,anon;
grant execute on function public.start_community_host(text,text,text,text,text,text[],text[],text) to authenticated;

notify pgrst, 'reload schema';
