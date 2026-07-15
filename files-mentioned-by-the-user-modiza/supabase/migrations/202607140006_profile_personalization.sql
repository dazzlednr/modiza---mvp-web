-- Part 4-4: editable profile introduction and profile image storage.

alter table public.profiles add column if not exists bio text;
grant update(bio) on public.profiles to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'profile-images',
  'profile-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads profile images" on storage.objects;
drop policy if exists "users upload own profile images" on storage.objects;
drop policy if exists "users update own profile images" on storage.objects;
drop policy if exists "users delete own profile images" on storage.objects;

create policy "public reads profile images" on storage.objects for select to anon, authenticated
  using (bucket_id = 'profile-images');
create policy "users upload own profile images" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own profile images" on storage.objects for update to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own profile images" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
