alter table public.spaces
  add column if not exists negotiation_contact_method text,
  add column if not exists negotiation_contact_value text;

alter table public.spaces
  drop constraint if exists spaces_negotiation_contact_method_check;

alter table public.spaces
  add constraint spaces_negotiation_contact_method_check
  check (
    negotiation_contact_method is null
    or negotiation_contact_method in (
      'store_phone',
      'kakao_open_chat',
      'kakao_channel',
      'instagram',
      'other'
    )
  );

with effective_contact as (
  select
    s.id,
    coalesce(
      case when cs.use_host_contact = false then cs.contact_method end,
      host.negotiation_contact_method
    ) as contact_method,
    coalesce(
      case when cs.use_host_contact = false then cs.contact_value end,
      host.negotiation_contact_value
    ) as contact_value
  from public.spaces s
  left join public.space_contact_settings cs on cs.space_id = s.id
  left join lateral (
    select
      a.negotiation_contact_method,
      a.negotiation_contact_value
    from public.space_host_applications a
    where a.user_id = s.owner_id
      and a.status = 'approved'
    order by a.reviewed_at desc nulls last, a.created_at desc
    limit 1
  ) host on true
)
update public.spaces s
set
  negotiation_contact_method = e.contact_method,
  negotiation_contact_value = e.contact_value
from effective_contact e
where e.id = s.id
  and (
    s.negotiation_contact_method is null
    or s.negotiation_contact_value is null
  );

comment on column public.spaces.negotiation_contact_method is
  'Public negotiation method shown in space usage information.';
comment on column public.spaces.negotiation_contact_value is
  'Public negotiation contact shown in space usage information.';

notify pgrst, 'reload schema';
