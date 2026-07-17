-- Structured space operations and community availability.
-- Legacy available_* columns remain populated for backward compatibility.

alter table public.spaces
  add column if not exists uses_day_specific_hours boolean not null default false,
  add column if not exists community_use_mode text not null default 'request_consultation'
    check (community_use_mode in ('idle_time_only','during_operation','request_consultation')),
  add column if not exists community_recurrence_type text not null default 'weekly'
    check (community_recurrence_type in ('weekly','date_range','specific_dates')),
  add column if not exists community_availability_start_date date,
  add column if not exists community_availability_end_date date,
  add column if not exists community_specific_dates date[] not null default '{}',
  add column if not exists minimum_order_or_fee text,
  add column if not exists additional_use_conditions text,
  add column if not exists preferred_contact_method text,
  add column if not exists private_contact text,
  add column if not exists min_capacity integer not null default 1 check (min_capacity > 0),
  add column if not exists difficult_activities text[] not null default '{}',
  add column if not exists usage_rules text;

create table if not exists public.space_operating_hours (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default false,
  start_time time,
  end_time time,
  has_break boolean not null default false,
  break_start_time time,
  break_end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(space_id, day_of_week),
  check (not is_open or (start_time is not null and end_time is not null)),
  check (not has_break or (break_start_time is not null and break_end_time is not null))
);

create table if not exists public.space_community_availability (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(space_id, day_of_week)
);

create index if not exists space_operating_hours_space_idx
  on public.space_operating_hours(space_id, day_of_week);
create index if not exists space_community_availability_space_idx
  on public.space_community_availability(space_id, day_of_week);

drop trigger if exists space_operating_hours_updated on public.space_operating_hours;
create trigger space_operating_hours_updated before update on public.space_operating_hours
for each row execute function public.set_updated_at();
drop trigger if exists space_community_availability_updated on public.space_community_availability;
create trigger space_community_availability_updated before update on public.space_community_availability
for each row execute function public.set_updated_at();

alter table public.space_operating_hours enable row level security;
alter table public.space_community_availability enable row level security;

drop policy if exists "space operating hours visible with space"
  on public.space_operating_hours;
create policy "space operating hours visible with space"
on public.space_operating_hours for select to anon, authenticated
using (exists (
  select 1 from public.spaces s where s.id = space_id
    and (
      s.status in ('active', 'approved')
      or s.owner_id = auth.uid()
      or public.current_user_is_admin()
    )
));

drop policy if exists "space owners manage operating hours"
  on public.space_operating_hours;
create policy "space owners manage operating hours"
on public.space_operating_hours for all to authenticated
using (exists (
  select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
))
with check (exists (
  select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
));

drop policy if exists "space community availability visible with space"
  on public.space_community_availability;
create policy "space community availability visible with space"
on public.space_community_availability for select to anon, authenticated
using (exists (
  select 1 from public.spaces s where s.id = space_id
    and (
      s.status in ('active', 'approved')
      or s.owner_id = auth.uid()
      or public.current_user_is_admin()
    )
));

drop policy if exists "space owners manage community availability"
  on public.space_community_availability;
create policy "space owners manage community availability"
on public.space_community_availability for all to authenticated
using (exists (
  select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
))
with check (exists (
  select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
));

grant select on public.space_operating_hours to anon, authenticated;
grant insert, update, delete on public.space_operating_hours to authenticated;
grant select on public.space_community_availability to anon, authenticated;
grant insert, update, delete on public.space_community_availability to authenticated;

-- Convert legacy hours without inventing data. Existing days use the recorded
-- common range; spaces with incomplete hours remain consultation-based.
insert into public.space_operating_hours (
  space_id, day_of_week, is_open, start_time, end_time, has_break
)
select s.id, d.day_of_week, true, s.available_start_time, s.available_end_time, false
from public.spaces s
cross join lateral (
  select case day_name
    when U&'\C77C' then 0 -- 일
    when U&'\C6D4' then 1 -- 월
    when U&'\D654' then 2 -- 화
    when U&'\C218' then 3 -- 수
    when U&'\BAA9' then 4 -- 목
    when U&'\AE08' then 5 -- 금
    when U&'\D1A0' then 6 -- 토
  end as day_of_week
  from unnest(s.available_days) day_name
) d
where d.day_of_week is not null
  and s.available_start_time is not null
  and s.available_end_time is not null
on conflict (space_id, day_of_week) do nothing;

notify pgrst, 'reload schema';
