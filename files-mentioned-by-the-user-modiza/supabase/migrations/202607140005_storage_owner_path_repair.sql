-- Part 4-3 repair: authorize new uploads by the authenticated owner's
-- first path segment. The API already verifies ownership before producing
-- {ownerId}/{resourceId}/{file} paths, while table RLS prevents attaching an
-- uploaded object to another user's community or space.

drop policy if exists "owners upload community images" on storage.objects;
drop policy if exists "owners change community images" on storage.objects;
drop policy if exists "owners delete community images" on storage.objects;
drop policy if exists "owners upload space images" on storage.objects;
drop policy if exists "owners change space images" on storage.objects;
drop policy if exists "owners delete space images" on storage.objects;

create policy "owners upload community images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) >= 2
  );

create policy "owners change community images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'community-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.communities c
        where c.thumbnail_storage_path = name and c.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'community-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners delete community images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'community-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.communities c
        where c.thumbnail_storage_path = name and c.owner_id = auth.uid()
      )
    )
  );

create policy "owners upload space images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'space-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and array_length(storage.foldername(name), 1) >= 2
  );

create policy "owners change space images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'space-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.space_images i
        join public.spaces s on s.id = i.space_id
        where i.storage_path = name and s.owner_id = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'space-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners delete space images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'space-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.space_images i
        join public.spaces s on s.id = i.space_id
        where i.storage_path = name and s.owner_id = auth.uid()
      )
    )
  );
