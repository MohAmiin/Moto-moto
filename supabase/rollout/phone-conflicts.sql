-- Read-only: accounts that share a phone number in any form, before applying
-- 20261011000000_one_account_per_phone.sql (which stops if any exist). Changes nothing.
-- Resolve each by hand (for example correct one account's number, or delete a test account);
-- the migration never merges or deletes accounts.
with numbers as (
  select u.id, 'login' as src, split_part(u.email, '@', 1) as raw from auth.users u where u.email like '%@pin.jareeye.app'
  union all select u.id, 'sms', u.phone from auth.users u where coalesce(u.phone, '') <> ''
  union all select p.id, 'profile', p.phone from public.profiles p where p.phone is not null
  union all select c.user_id, 'pin', c.phone from public.pin_credentials c
), canonical as (
  select id, src, raw, '252' || case when length(d) = 7 then '63' || d else d end as phone
  from (select id, src, raw, regexp_replace(regexp_replace(regexp_replace(raw, '\D', '', 'g'), '^(00)?252', ''), '^0', '') as d from numbers) x
  where d <> ''
)
select c.phone, array_agg(distinct c.id) as user_ids, array_agg(distinct c.src || '=' || c.raw) as found_as,
       array_agg(distinct p.full_name) filter (where p.full_name is not null) as names
from canonical c left join public.profiles p on p.id = c.id
group by c.phone having count(distinct c.id) > 1
order by c.phone;
