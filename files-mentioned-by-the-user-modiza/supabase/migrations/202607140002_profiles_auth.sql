create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nickname text not null check (char_length(nickname) between 2 and 30),
  profile_image text,
  roles text[] not null default array['member']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_member_role_only check (
    roles = array['member']::text[]
  )
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(nickname, profile_image) on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nickname, roles)
  values (
    new.id,
    new.email,
    case
      when char_length(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(new.email, '@', 1))) >= 2
        then coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(new.email, '@', 1))
      else coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(new.email, '@', 1)) || '_'
    end,
    array['member']::text[]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

insert into public.profiles (id, email, nickname, roles, created_at, updated_at)
select
  id,
  email,
  case
    when char_length(coalesce(nullif(trim(raw_user_meta_data ->> 'nickname'), ''), split_part(email, '@', 1))) >= 2
      then coalesce(nullif(trim(raw_user_meta_data ->> 'nickname'), ''), split_part(email, '@', 1))
    else coalesce(nullif(trim(raw_user_meta_data ->> 'nickname'), ''), split_part(email, '@', 1)) || '_'
  end,
  array['member']::text[],
  created_at,
  updated_at
from auth.users
where email is not null
on conflict (id) do nothing;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();
