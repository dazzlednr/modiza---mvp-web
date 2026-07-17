-- Part 5-1: profile interests and private community favorites.
alter table public.profiles
  add column if not exists interested_categories text[] not null default array[]::text[],
  add column if not exists interested_regions text[] not null default array[]::text[];

-- Preserve interests collected by the earlier signup/profile implementation.
update public.profiles
set interested_categories = interest_categories
where coalesce(array_length(interested_categories, 1), 0) = 0
  and coalesce(array_length(interest_categories, 1), 0) > 0;

create table if not exists public.community_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_favorites_user_community_unique unique(user_id, community_id)
);
create index if not exists community_favorites_user_created_idx
  on public.community_favorites(user_id, created_at desc);
create index if not exists community_favorites_community_idx
  on public.community_favorites(community_id);

alter table public.community_favorites enable row level security;
drop policy if exists "users read own community favorites" on public.community_favorites;
drop policy if exists "users add own community favorites" on public.community_favorites;
drop policy if exists "users remove own community favorites" on public.community_favorites;
create policy "users read own community favorites" on public.community_favorites
  for select to authenticated using(user_id = auth.uid());
create policy "users add own community favorites" on public.community_favorites
  for insert to authenticated with check(user_id = auth.uid() and public.current_user_has_role('member'));
create policy "users remove own community favorites" on public.community_favorites
  for delete to authenticated using(user_id = auth.uid() and public.current_user_has_role('member'));

grant select,insert,delete on public.community_favorites to authenticated;
grant all on public.community_favorites to service_role;
grant update(interested_categories,interested_regions) on public.profiles to authenticated;

notify pgrst, 'reload schema';
