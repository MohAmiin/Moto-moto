-- One current rating per customer per rider, tied to an eligible logged call
-- (20261009000000_one_rating_per_customer.sql).

-- Logged calls: customers only, never on themselves, repeats within 2 minutes count once.
do $$
declare rider uuid; other_rider uuid; customer uuid; admin_id uuid;
begin
  rider := pg_temp.new_rider('252634200001');
  other_rider := pg_temp.new_rider('252634200002');
  customer := pg_temp.new_user('252634200010', 'customer');
  admin_id := pg_temp.new_user('252634200099', 'admin');

  perform pg_temp.act_as(rider);
  perform pg_temp.throws(format($q$select log_call(%L)$q$, rider), 'cannot call yourself', 'riders cannot log calls to themselves');
  perform pg_temp.throws(format($q$select log_call(%L)$q$, other_rider), 'only customers', 'riders cannot log calls (or rate) other riders');
  perform pg_temp.throws(format($q$insert into calls (caller_id, rider_id) values (%L, %L)$q$, rider, rider), 'row-level security', 'calls cannot be inserted directly');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(customer);
  perform log_call(rider);
  perform log_call(rider);
  perform log_call(rider);
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select count(*)::int from calls where caller_id = customer and rider_id = rider), 1, 'repeated taps within 2 minutes count once');
end $$;

-- A customer's rating replaces their earlier one; it needs an eligible call; it can't be stuffed.
do $$
declare rider uuid; customer uuid; customer2 uuid; call1 uuid; call2 uuid; call3 uuid; fresh uuid; r record;
begin
  rider := pg_temp.new_rider('252634200003');
  customer := pg_temp.new_user('252634200011', 'customer');
  customer2 := pg_temp.new_user('252634200012', 'customer');

  insert into calls (caller_id, rider_id, created_at) values (customer, rider, now() - interval '2 days') returning id into call1;
  insert into calls (caller_id, rider_id, created_at) values (customer, rider, now() - interval '10 minutes') returning id into call2;
  insert into calls (caller_id, rider_id, created_at) values (customer2, rider, now() - interval '10 minutes') returning id into call3;
  insert into calls (caller_id, rider_id, created_at) values (customer, rider, now() - interval '1 minute') returning id into fresh;

  perform pg_temp.act_as(customer);
  perform pg_temp.throws(format($q$select rate_call(%L, 1)$q$, fresh), 'call not found', 'a call under 3 minutes old cannot be rated yet');
  perform rate_call(call1, 1);
  perform pg_temp.throws(format($q$select rate_call(%L, 1)$q$, call1), 'call not found', 'a call can be rated only once');
  perform pg_temp.throws(format($q$select rate_call(%L, 1)$q$, call3), 'call not found', 'customers cannot rate someone else''s call');
  perform pg_temp.act_as_owner();
  -- rate_call(call1) also closed the older-or-equal unrated calls; call2 is newer, so still open.
  perform pg_temp.act_as(customer);
  perform rate_call(call2, 5);
  perform pg_temp.act_as_owner();

  perform pg_temp.eq((select count(*)::int from rider_ratings where rider_id = rider and customer_id = customer), 1, 'one rating per customer per rider');
  perform pg_temp.eq((select stars from rider_ratings where rider_id = rider and customer_id = customer), 5::smallint, 'the newest rating replaces the old one');
  perform pg_temp.eq((select call_id from rider_ratings where rider_id = rider and customer_id = customer), call2, 'the rating is tied to the call it came from');

  perform pg_temp.act_as(customer2);
  perform rate_call(call3, 3);
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(customer);
  select * into r from nearby_riders() where id = rider;
  perform pg_temp.act_as_owner();
  -- Not online, so not listed; check the numbers the list would use instead.
  perform pg_temp.eq((select round(avg(stars)::numeric, 1) from rider_ratings where rider_id = rider), 4.0, 'average of the two customers (5 and 3)');

  perform pg_temp.act_as(rider);
  select * into r from my_rating();
  perform pg_temp.eq(r.rating, 4.0, 'the rider sees their average');
  perform pg_temp.eq(r.rating_count, 2, 'the rider sees how many customers rated them');
  perform pg_temp.eq((select count(*)::int from rider_ratings), 0, 'riders cannot see who gave which stars');
  perform pg_temp.throws(format($q$insert into rider_ratings (rider_id, customer_id, stars) values (%L, %L, 5)$q$, rider, customer), 'row-level security', 'ratings cannot be written directly');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(customer);
  perform pg_temp.eq((select count(*)::int from rider_ratings), 1, 'customers see only their own rating');
  perform pg_temp.act_as_owner();
end $$;

-- nearby_riders uses one rating per customer.
do $$
declare rider uuid; customer uuid; r record;
begin
  rider := pg_temp.new_rider('252634200004');
  customer := pg_temp.new_user('252634200013', 'customer');
  update profiles set is_online = true, last_seen_at = now(), lat = 9.56, lng = 44.07 where id = rider;
  -- Ten 1-star ratings from the same customer in the old calls table must count once.
  insert into calls (caller_id, rider_id, stars, rated_at, created_at)
  select customer, rider, 1, now(), now() - interval '1 hour' from generate_series(1, 10);
  insert into rider_ratings (rider_id, customer_id, stars) values (rider, customer, 1);

  perform pg_temp.act_as(customer);
  select * into r from nearby_riders(9.56, 44.07, null) where id = rider;
  perform pg_temp.act_as_owner();
  perform pg_temp.eq(r.rating_count, 1, 'repeated old ratings count as one');
end $$;
