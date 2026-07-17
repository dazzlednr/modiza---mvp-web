do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from auth.users
  where lower(email) = lower('dazzlednr@gmail.com')
  limit 1;

  if target_user_id is null then
    raise exception 'USER_NOT_FOUND: dazzlednr@gmail.com';
  end if;

  update public.profiles
  set
    roles = public.normalize_profile_roles(
      coalesce(roles, array['member']::text[])
      || array['space_host']::text[]
    ),
    updated_at = now()
  where id = target_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND: dazzlednr@gmail.com';
  end if;
end
$$;

notify pgrst, 'reload schema';
