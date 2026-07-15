create table public.space_recommendation_reasons (
  id uuid primary key default gen_random_uuid(),
  condition_hash text not null,
  space_id uuid not null references public.spaces(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(condition_hash, space_id)
);

create trigger space_recommendation_reasons_updated
before update on public.space_recommendation_reasons
for each row execute function public.set_updated_at();

create index space_recommendation_reasons_hash_idx
on public.space_recommendation_reasons(condition_hash);

alter table public.space_recommendation_reasons enable row level security;
grant all on public.space_recommendation_reasons to service_role;

alter table public.communities
add column space_id uuid references public.spaces(id) on delete set null;

create index communities_space_idx on public.communities(space_id);
