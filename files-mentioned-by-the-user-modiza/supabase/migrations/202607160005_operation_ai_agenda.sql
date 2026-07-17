create table if not exists public.schedule_agenda_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);
create index if not exists schedule_agenda_items_schedule_idx on public.schedule_agenda_items(schedule_id,sort_order);
drop trigger if exists schedule_agenda_items_updated on public.schedule_agenda_items;
create trigger schedule_agenda_items_updated before update on public.schedule_agenda_items for each row execute function public.set_updated_at();
alter table public.schedule_agenda_items enable row level security;
drop policy if exists "community owners manage schedule agenda" on public.schedule_agenda_items;
create policy "community owners manage schedule agenda" on public.schedule_agenda_items for all to authenticated
using (exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()))
with check (exists(select 1 from public.communities c where c.id=community_id and c.owner_id=auth.uid()));
grant select,insert,update,delete on public.schedule_agenda_items to authenticated;
