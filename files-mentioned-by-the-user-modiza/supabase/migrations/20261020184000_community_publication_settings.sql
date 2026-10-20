alter table public.communities
  add column if not exists visibility text not null default 'discover',
  add column if not exists participant_eligibility text not null default 'anyone';

alter table public.communities
  drop constraint if exists communities_visibility_check,
  drop constraint if exists communities_participant_eligibility_check;

alter table public.communities
  add constraint communities_visibility_check
    check (visibility in ('discover', 'link_only')),
  add constraint communities_participant_eligibility_check
    check (participant_eligibility in ('anyone', 'community_members'));

comment on column public.communities.visibility is
  'discover appears in MODIZA discovery; link_only is available only through its shared URL.';

comment on column public.communities.participant_eligibility is
  'community_members stores the setting; automatic membership verification is introduced separately.';
