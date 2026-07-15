-- Part 4-3 demo ownership transfer example.
-- This file is intentionally non-executable until you replace the placeholders.
-- Find a user's UUID in Supabase Dashboard > Authentication > Users.

-- begin;

-- update public.communities
-- set owner_id = '<COMMUNITY_HOST_AUTH_USER_UUID>'::uuid
-- where owner_id is null
--   and slug in ('replace-with-community-slug');

-- update public.spaces
-- set owner_id = '<SPACE_HOST_AUTH_USER_UUID>'::uuid
-- where owner_id is null
--   and slug in ('replace-with-space-slug');

-- Verify the rows and roles before committing.
-- select id, slug, owner_id from public.communities where owner_id is not null;
-- select id, slug, owner_id from public.spaces where owner_id is not null;
-- select id, email, roles from public.profiles where id in (
--   '<COMMUNITY_HOST_AUTH_USER_UUID>'::uuid,
--   '<SPACE_HOST_AUTH_USER_UUID>'::uuid
-- );

-- commit;
