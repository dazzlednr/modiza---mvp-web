-- Makes the community registration schema reproducible even when the earlier
-- community operations migration was empty or was applied only in Dashboard.

alter table public.communities
  add column if not exists operator_id uuid,
  add column if not exists linked_space_id uuid,
  add column if not exists space_id uuid,
  add column if not exists main_region text,
  add column if not exists detailed_region text,
  add column if not exists thumbnail_storage_path text,
  add column if not exists recruitment_status text,
  add column if not exists legacy_recruitment_status text,
  add column if not exists recruitment_start_at timestamptz,
  add column if not exists recruitment_end_at timestamptz,
  add column if not exists meeting_end_at timestamptz,
  add column if not exists participation_fee integer,
  add column if not exists target_audience text,
  add column if not exists rules text,
  add column if not exists preparation_items text,
  add column if not exists application_questions jsonb not null default '[]'::jsonb;

update public.communities
set
  main_region = coalesce(main_region, region),
  participation_fee = coalesce(participation_fee, fee, 0),
  recruitment_status = coalesce(
    recruitment_status,
    case when status in ('recruiting', 'closed', 'upcoming') then status end,
    'upcoming'
  ),
  legacy_recruitment_status = coalesce(
    legacy_recruitment_status,
    case when status in ('recruiting', 'closed', 'upcoming') then status end,
    'upcoming'
  ),
  linked_space_id = coalesce(linked_space_id, space_id),
  status = case
    when status in ('recruiting', 'closed', 'upcoming') then 'published'
    else status
  end;

alter table public.communities
  alter column main_region set default '기타',
  alter column detailed_region set default '',
  alter column recruitment_status set default 'upcoming',
  alter column participation_fee set default 0;

alter table public.communities drop constraint if exists communities_status_check;
alter table public.communities drop constraint if exists communities_publication_status_check;
alter table public.communities
  add constraint communities_publication_status_check
  check (status in ('draft', 'published', 'ended', 'inactive'));

alter table public.communities drop constraint if exists communities_participation_type_check;
alter table public.communities
  add constraint communities_participation_type_check
  check (participation_type in ('offline', 'online', 'hybrid'));

alter table public.communities drop constraint if exists communities_recruitment_status_check;
alter table public.communities
  add constraint communities_recruitment_status_check
  check (recruitment_status in ('recruiting', 'closed', 'upcoming'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'communities_operator_id_fkey'
  ) then
    alter table public.communities
      add constraint communities_operator_id_fkey
      foreign key (operator_id) references public.demo_space_operators(id)
      on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'communities_linked_space_id_fkey'
  ) then
    alter table public.communities
      add constraint communities_linked_space_id_fkey
      foreign key (linked_space_id) references public.spaces(id)
      on delete set null;
  end if;
end $$;

create index if not exists communities_operator_idx on public.communities(operator_id);
create index if not exists communities_linked_space_idx on public.communities(linked_space_id);
create index if not exists communities_publication_status_idx on public.communities(status);

insert into public.demo_space_operators(name)
select '모디자 데모 운영자'
where not exists (select 1 from public.demo_space_operators);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values(
  'community-images',
  'community-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public reads community images bucket'
  ) then
    create policy "public reads community images bucket"
      on storage.objects for select to anon
      using (bucket_id = 'community-images');
  end if;
end $$;

grant select on public.communities to anon;
grant all on public.communities to service_role;
