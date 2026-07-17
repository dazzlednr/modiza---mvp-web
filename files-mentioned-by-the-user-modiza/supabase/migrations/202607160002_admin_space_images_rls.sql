-- Administrators can create spaces through the same owner-scoped UI as verified
-- space hosts. The spaces table already had an admin policy, but its child image
-- and analysis tables did not, causing registration to fail after file upload.

drop policy if exists "admins manage space images" on public.space_images;
create policy "admins manage space images"
  on public.space_images for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "admins manage space analysis" on public.space_analysis;
create policy "admins manage space analysis"
  on public.space_analysis for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

notify pgrst, 'reload schema';
