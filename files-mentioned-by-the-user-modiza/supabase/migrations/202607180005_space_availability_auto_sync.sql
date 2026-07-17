-- Persist whether community availability is still linked to operating hours.
-- Existing spaces remain detached so their separately-entered availability is
-- never overwritten when edited. New registrations default to linked.

alter table public.spaces
  add column if not exists community_availability_auto_sync boolean;

update public.spaces
set community_availability_auto_sync = false
where community_availability_auto_sync is null;

alter table public.spaces
  alter column community_availability_auto_sync set default true,
  alter column community_availability_auto_sync set not null;

comment on column public.spaces.community_availability_auto_sync is
  'True while the registration UI mirrors operating hours into separately stored community availability rows.';

notify pgrst, 'reload schema';
