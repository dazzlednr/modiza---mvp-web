create table public.space_analysis(id uuid primary key default gen_random_uuid(),space_id uuid not null unique references public.spaces(id) on delete cascade,analysis_json jsonb not null,image_signature text not null,model text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create trigger space_analysis_updated before update on public.space_analysis for each row execute function public.set_updated_at();
alter table public.space_analysis enable row level security;
grant all on public.space_analysis to service_role;
create index space_analysis_space_idx on public.space_analysis(space_id);
