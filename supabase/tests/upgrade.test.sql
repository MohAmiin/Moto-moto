-- Upgrading a database that already has accounts, ratings and reset requests: re-runs the three new
-- migrations on top of existing data (also checks they are safe to run more than once).

alter table auth.users disable trigger copy_legacy_pin_credential;
drop table if exists pg_temp.ids;
create temp table ids as
select pg_temp.new_user('252634300001', 'customer', '4455') as customer,
       pg_temp.new_rider('252634300002') as rider,
       pg_temp.new_rider('252634300003') as self_rater;
alter table auth.users enable trigger copy_legacy_pin_credential;
delete from pin_credentials where user_id in (select customer from ids union select rider from ids);

-- An old-style pending reset request, two ratings by the same customer, and a rider's self-rating.
insert into pin_resets (user_id, phone, pin_hash) select customer, '252634300001', 'x' from ids;
insert into calls (caller_id, rider_id, stars, rated_at, created_at)
select customer, rider, 2, now() - interval '2 days', now() - interval '2 days' from ids
union all select customer, rider, 4, now() - interval '1 day', now() - interval '1 day' from ids
union all select self_rater, self_rater, 5, now(), now() - interval '1 hour' from ids;

\i supabase/migrations/20261007000000_pin_security.sql
\i supabase/migrations/20261008000000_rider_phone_verification.sql
\i supabase/migrations/20261009000000_one_rating_per_customer.sql

do $$
declare i ids;
begin
  select * into i from ids;
  perform pg_temp.eq((select scheme from pin_credentials where user_id = i.customer), 'legacy4', 'existing accounts get their PIN copied');
  perform pg_temp.eq((select outcome from pin_login('252634300001', '4455', '10.6.0.1')), 'ok', 'existing 4-digit PIN still works after the upgrade');
  perform pg_temp.eq((select status from pin_resets where user_id = i.customer), 'rejected', 'old unverifiable reset requests are closed');
  perform pg_temp.eq((select stars from rider_ratings where rider_id = i.rider and customer_id = i.customer), 4::smallint, 'each customer''s latest rating is kept');
  perform pg_temp.eq((select count(*)::int from rider_ratings where rider_id = i.rider), 1, 'repeat ratings become one');
  perform pg_temp.eq((select count(*)::int from rider_ratings where rider_id = i.self_rater), 0, 'self-ratings are dropped');
  perform pg_temp.eq((select status from rider_applications where user_id = i.rider), 'approved'::application_status, 'approved riders stay approved');
end $$;
