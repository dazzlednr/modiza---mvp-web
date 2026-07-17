-- Persistent community-host revocation. Removing only profiles.roles would let
-- a user immediately self-activate again, so the onboarding RPC enforces this flag.

alter table public.profiles
  add column if not exists community_host_revoked_at timestamptz,
  add column if not exists community_host_revocation_reason text;

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
  if exists(
    select 1 from public.profiles
    where id=auth.uid() and community_host_revoked_at is not null
  ) then
    raise exception 'COMMUNITY_HOST_REVOKED' using errcode='42501';
  end if;

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
