-- Align legacy community rows with the fixed MODIZA category taxonomy.
update public.communities
set category = case category
  when '독서' then '독서·인문'
  when '음악' then '음악·악기'
  when '영화' then '문화·예술'
  when '여행' then '여행·나들이'
  when '네트워킹' then '사교·네트워킹'
  when '기타' then '취미'
  else category
end,
custom_category = null
where category in ('독서', '음악', '영화', '여행', '네트워킹', '기타');

update public.profiles
set interested_categories = array(
  select distinct case item
    when '독서' then '독서·인문' when '음악' then '음악·악기'
    when '영화' then '문화·예술' when '여행' then '여행·나들이'
    when '네트워킹' then '사교·네트워킹' when '기타' then '취미'
    else item end
  from unnest(coalesce(interested_categories, '{}')) as item
),
interest_categories = array(
  select distinct case item
    when '독서' then '독서·인문' when '음악' then '음악·악기'
    when '영화' then '문화·예술' when '여행' then '여행·나들이'
    when '네트워킹' then '사교·네트워킹' when '기타' then '취미'
    else item end
  from unnest(coalesce(interest_categories, '{}')) as item
);

update public.community_host_profiles
set interest_categories = array(
  select distinct case item
    when '독서' then '독서·인문' when '음악' then '음악·악기'
    when '영화' then '문화·예술' when '여행' then '여행·나들이'
    when '네트워킹' then '사교·네트워킹' when '기타' then '취미'
    else item end
  from unnest(coalesce(interest_categories, '{}')) as item
);

notify pgrst, 'reload schema';
