-- Structured address metadata for Kakao Postcode selections.
-- Existing free-form addresses are intentionally left untouched and un-derived.

alter table public.spaces
  add column if not exists postal_code text,
  add column if not exists road_address text,
  add column if not exists jibun_address text,
  add column if not exists building_name text,
  add column if not exists address_sido text,
  add column if not exists address_sigungu text,
  add column if not exists address_dong text;

comment on column public.spaces.address is
  'Backward-compatible base address. For new records this mirrors road_address.';
comment on column public.spaces.address_detail is
  'Optional building, floor, or unit detail entered by the operator.';
comment on column public.spaces.road_address is
  'Road address selected through Kakao Postcode. Null for unconverted legacy records.';
comment on column public.spaces.jibun_address is
  'Jibun address returned by Kakao Postcode; not inferred for legacy records.';
comment on column public.spaces.address_sido is
  'Province/metropolitan city returned by Kakao Postcode.';
comment on column public.spaces.address_sigungu is
  'District/county returned by Kakao Postcode and used for region mapping.';

notify pgrst, 'reload schema';
