-- Optional demo-data refresh. Run after seed.sql when the demo rows already exist.
update public.communities as c set next_meeting_at = v.meeting_at, status = 'published', recruitment_status = 'recruiting'
from (values
  ('daegu-indie-film','2026-12-05 14:00+09'::timestamptz),
  ('after-work-books','2026-12-08 19:00+09'::timestamptz),
  ('weekend-photo-walk','2026-12-12 11:00+09'::timestamptz),
  ('local-founders','2026-12-15 19:30+09'::timestamptz),
  ('one-sentence','2026-12-19 16:00+09'::timestamptz),
  ('deep-jazz','2026-12-21 20:00+09'::timestamptz),
  ('sunday-runners','2026-12-23 08:00+09'::timestamptz),
  ('craft-saturday','2026-12-24 14:00+09'::timestamptz),
  ('gallery-explorers','2026-12-26 15:00+09'::timestamptz),
  ('sidework','2026-12-27 18:00+09'::timestamptz),
  ('climbing-day','2026-12-29 18:30+09'::timestamptz),
  ('local-music-lab','2026-12-30 19:30+09'::timestamptz)
) as v(slug,meeting_at) where c.slug = v.slug;

update public.communities set recruitment_start_at = created_at, recruitment_end_at = next_meeting_at - interval '1 hour'
where slug in ('daegu-indie-film','after-work-books','weekend-photo-walk','local-founders','one-sentence','deep-jazz','sunday-runners','craft-saturday','gallery-explorers','sidework','climbing-day','local-music-lab');

update public.schedules as s set date = c.next_meeting_at::date, start_time = c.next_meeting_at::time
from public.communities c where s.community_id = c.id and c.slug in ('daegu-indie-film','after-work-books','weekend-photo-walk','local-founders','one-sentence','deep-jazz','sunday-runners','craft-saturday','gallery-explorers','sidework','climbing-day','local-music-lab');
