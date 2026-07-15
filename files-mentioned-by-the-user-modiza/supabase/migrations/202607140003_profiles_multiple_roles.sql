-- Part 4-2: allow one account to own multiple MODIZA roles.
-- Community/space ownership and their RLS remain unchanged until Part 4-3.

alter table public.profiles
  drop constraint if exists profiles_member_role_only;

create or replace function public.normalize_profile_roles(input_roles text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array_agg(role order by position),
    array['member']::text[]
  )
  from (
    select distinct
      role,
      case role
        when 'member' then 1
        when 'community_host' then 2
        when 'space_host' then 3
        when 'admin' then 4
      end as position
    from unnest(
      coalesce(input_roles, array[]::text[]) || array['member']::text[]
    ) as role
    where role = any(array['member', 'community_host', 'space_host', 'admin']::text[])
  ) normalized;
$$;

update public.profiles
set roles = public.normalize_profile_roles(roles)
where roles is null
   or roles <> public.normalize_profile_roles(roles);

alter table public.profiles
  alter column roles set default array['member']::text[],
  alter column roles set not null;

alter table public.profiles
  drop constraint if exists profiles_roles_valid,
  add constraint profiles_roles_valid check (
    roles = public.normalize_profile_roles(roles)
    and roles <@ array['member', 'community_host', 'space_host', 'admin']::text[]
    and roles @> array['member']::text[]
  );

create or replace function public.add_current_user_role(requested_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if requested_role not in ('community_host', 'space_host') then
    raise exception 'ROLE_NOT_ALLOWED' using errcode = '22023';
  end if;

  update public.profiles
  set roles = public.normalize_profile_roles(roles || array[requested_role]::text[])
  where id = current_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.ensure_current_member_role()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  updated_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.profiles
  set roles = public.normalize_profile_roles(roles)
  where id = current_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.add_current_user_role(text) from public, anon;
grant execute on function public.add_current_user_role(text) to authenticated;
revoke all on function public.ensure_current_member_role() from public, anon;
grant execute on function public.ensure_current_member_role() to authenticated;

-- Roles remain excluded from the authenticated column-level UPDATE grant.
-- Only the validated SECURITY DEFINER functions above can change them.
revoke update(roles) on public.profiles from authenticated;
