-- Unified Daegu regions, signup personalization and multi-step community fields.
alter table public.profiles
  add column if not exists main_region text not null default '대구 전체',
  add column if not exists detailed_region text,
  add column if not exists custom_region text,
  add column if not exists interest_categories text[] not null default '{}';

alter table public.communities
  add column if not exists custom_category text,
  add column if not exists custom_region text,
  add column if not exists activity_description text not null default '',
  add column if not exists mood_tags text[] not null default '{}',
  add column if not exists required_facilities text[] not null default '{}',
  add column if not exists indoor_outdoor text not null default 'indoor',
  add column if not exists food_drink_needed boolean not null default false,
  add column if not exists expected_duration_hours numeric(4,1) not null default 2,
  add column if not exists budget_min integer not null default 0,
  add column if not exists budget_max integer not null default 0,
  add column if not exists travel_range text not null default '',
  add constraint communities_indoor_outdoor_check check (indoor_outdoor in ('indoor','outdoor','both'));

alter table public.spaces add column if not exists custom_region text;

update public.communities set
  custom_region = case when coalesce(detailed_region, main_region, region) not in ('중구','동구','서구','남구','북구','수성구','수성','달서구','달성군','달성') then coalesce(detailed_region, main_region, region) else custom_region end,
  detailed_region = case
    when coalesce(detailed_region, main_region, region) in ('수성구','수성','수성못') then '수성구'
    when coalesce(detailed_region, main_region, region) in ('달성군','달성') then '달성군'
    when coalesce(detailed_region, main_region, region) = '동성로' then '중구'
    when coalesce(detailed_region, main_region, region) = '경북대' then '북구'
    when coalesce(detailed_region, main_region, region) = '계명대' then '달서구'
    when coalesce(detailed_region, main_region, region) = '앞산' then '남구'
    when coalesce(detailed_region, main_region, region) in ('중구','동구','서구','남구','북구','달서구') then coalesce(detailed_region, main_region, region)
    else '기타' end,
  main_region = '대구 전체', region = '대구 전체';

update public.communities set category = case category
  when '글쓰기' then '자기계발' when '사진' then '취미' when '운동' then '운동·스포츠'
  when '스터디' then '자기계발' when '전시·공연' then '문화·예술' else category end;

update public.spaces set
  custom_region = case when coalesce(detailed_region, main_region) not in ('중구','동구','서구','남구','북구','수성구','수성','달서구','달성군','달성') then coalesce(detailed_region, main_region) else custom_region end,
  detailed_region = case
    when coalesce(detailed_region, main_region) in ('수성구','수성','수성못') then '수성구'
    when coalesce(detailed_region, main_region) in ('달성군','달성') then '달성군'
    when coalesce(detailed_region, main_region) = '동성로' then '중구'
    when coalesce(detailed_region, main_region) = '경북대' then '북구'
    when coalesce(detailed_region, main_region) = '계명대' then '달서구'
    when coalesce(detailed_region, main_region) = '앞산' then '남구'
    when coalesce(detailed_region, main_region) in ('중구','동구','서구','남구','북구','달서구') then coalesce(detailed_region, main_region)
    else '기타' end,
  main_region = '대구 전체';

create or replace function public.set_community_recruitment_window()
returns trigger language plpgsql as $$
begin
  if new.next_meeting_at is not null then
    new.recruitment_start_at := coalesce(new.created_at, now());
    new.recruitment_end_at := new.next_meeting_at - interval '1 hour';
    if new.status = 'published' then
      new.recruitment_status := case
        when now() >= new.next_meeting_at - interval '1 hour' then 'closed'
        when coalesce(new.current_members,0) >= coalesce(new.capacity,1) then 'closed'
        else 'recruiting' end;
      new.legacy_recruitment_status := new.recruitment_status;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists communities_recruitment_window on public.communities;
create trigger communities_recruitment_window before insert or update of next_meeting_at,status,capacity,current_members on public.communities for each row execute function public.set_community_recruitment_window();

grant update(main_region,detailed_region,custom_region,interest_categories) on public.profiles to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,nickname,roles,main_region,detailed_region,custom_region,interest_categories)
  values(
    new.id,
    coalesce(new.email,''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'),''),split_part(coalesce(new.email,''),'@',1),'모디자 회원'),
    case when new.raw_user_meta_data->>'member_type' = 'community_host' then array['member','community_host']::text[] else array['member']::text[] end,
    '대구 전체',
    nullif(new.raw_user_meta_data->>'detailed_region',''),
    nullif(new.raw_user_meta_data->>'custom_region',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'interest_categories','[]'::jsonb))),array[]::text[])
  ) on conflict(id) do nothing;
  return new;
end $$;
