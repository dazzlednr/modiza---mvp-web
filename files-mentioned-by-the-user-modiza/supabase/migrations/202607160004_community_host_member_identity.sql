-- Reuse the member identity for community hosts. Nickname and profile image are
-- stored only in profiles; the host table keeps host-specific information.

drop function if exists public.start_community_host(text,text,text,text,text,text[],text[],text);

alter table public.community_host_profiles
  drop column if exists display_name,
  drop column if exists profile_image_url,
  drop column if exists social_url;

alter table public.community_host_profiles
  alter column activity_region drop not null;

create or replace function public.start_community_host(
  p_headline text,
  p_introduction text,
  p_activity_region text default null,
  p_interest_categories text[] default '{}'::text[],
  p_operating_styles text[] default '{}'::text[]
) returns public.community_host_profiles
language plpgsql security definer set search_path=''
as $$
declare result public.community_host_profiles;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if not public.current_user_is_active() then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and community_host_revoked_at is not null) then
    raise exception 'COMMUNITY_HOST_REVOKED' using errcode='42501';
  end if;

  insert into public.community_host_profiles(
    user_id,headline,introduction,activity_region,interest_categories,operating_styles
  ) values(
    auth.uid(),trim(p_headline),trim(p_introduction),nullif(trim(p_activity_region),''),
    coalesce(p_interest_categories,'{}'),coalesce(p_operating_styles,'{}')
  ) on conflict(user_id) do update set
    headline=excluded.headline,introduction=excluded.introduction,
    activity_region=excluded.activity_region,interest_categories=excluded.interest_categories,
    operating_styles=excluded.operating_styles
  returning * into result;

  update public.profiles
    set roles=public.normalize_profile_roles(roles || array['community_host']::text[])
    where id=auth.uid();
  return result;
end $$;

revoke all on function public.start_community_host(text,text,text,text[],text[]) from public,anon;
grant execute on function public.start_community_host(text,text,text,text[],text[]) to authenticated;

-- Returns only the public member identity plus host-specific fields. Email,
-- roles, account state, and other private profile columns are never exposed.
create or replace function public.get_public_community_host_profile(p_user_id uuid)
returns table(
  user_id uuid,nickname text,profile_image text,headline text,introduction text,
  activity_region text,interest_categories text[],operating_styles text[],
  started_at timestamptz,created_at timestamptz,updated_at timestamptz
)
language sql stable security definer set search_path=''
as $$
  select h.user_id,p.nickname,p.profile_image,h.headline,h.introduction,h.activity_region,
    h.interest_categories,h.operating_styles,h.started_at,h.created_at,h.updated_at
  from public.community_host_profiles h
  join public.profiles p on p.id=h.user_id
  where h.user_id=p_user_id
    and p.account_status='active'
    and (
      h.user_id=auth.uid()
      or exists(select 1 from public.communities c where c.owner_id=h.user_id and c.status='published' and c.deleted_at is null)
    );
$$;

revoke all on function public.get_public_community_host_profile(uuid) from public;
grant execute on function public.get_public_community_host_profile(uuid) to anon,authenticated;

notify pgrst, 'reload schema';
