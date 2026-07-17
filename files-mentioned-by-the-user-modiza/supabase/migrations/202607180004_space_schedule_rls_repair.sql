-- Repair child-row writes during space registration.
--
-- The API intentionally lets an administrator use space-host routes, but the
-- original child-table policies only recognized the explicit space_host role.
-- The parent space row was therefore created successfully while its operating
-- hours failed with SQLSTATE 42501. Keep ownership and editable-status checks,
-- and align these child policies with the existing admin authorization rule.

drop policy if exists "space owners manage operating hours"
  on public.space_operating_hours;
create policy "space owners manage operating hours"
on public.space_operating_hours for all to authenticated
using (exists (
  select 1
  from public.spaces s
  where s.id = space_id
    and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
))
with check (exists (
  select 1
  from public.spaces s
  where s.id = space_id
    and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
));

drop policy if exists "space owners manage community availability"
  on public.space_community_availability;
create policy "space owners manage community availability"
on public.space_community_availability for all to authenticated
using (exists (
  select 1
  from public.spaces s
  where s.id = space_id
    and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
))
with check (exists (
  select 1
  from public.spaces s
  where s.id = space_id
    and s.owner_id = auth.uid()
    and s.status not in ('pending', 'suspended')
    and (
      public.current_user_has_role('space_host')
      or public.current_user_is_admin()
    )
));

notify pgrst, 'reload schema';
