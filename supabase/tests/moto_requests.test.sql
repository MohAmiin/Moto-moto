-- Request a moto (20261012000000_moto_requests.sql): waves, who may get a request, accepting once,
-- the job steps, cancelling, rating, privacy and admin figures.
-- Positions are around a pickup in Hargeisa; 0.009° of latitude is about 1 km.

create function pg_temp.place(p_id uuid, p_km_north double precision, p_seen interval default '0 seconds', p_online boolean default true)
returns void language sql as $$
  update public.profiles set is_online = p_online, lat = 9.5600 + p_km_north * 0.009, lng = 44.0650,
         last_seen_at = now() - p_seen, busy_until = null
  where id = p_id;
$$;

create function pg_temp.request_from(p_customer uuid, p_note text default 'Small box') returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.act_as(p_customer);
  v := create_moto_request(9.5600, 44.0650, 'Jigjiga Yar', 9.5800, 44.0700, 'Hospital', p_note);
  perform pg_temp.act_as_owner();
  return v;
end;
$$;

-- Blocks share one transaction: each block starts with every earlier rider offline.
create function pg_temp.riders_off() returns void language sql as $$
  update public.profiles set is_online = false where role = 'rider';
$$;

-- Waves: nearest first within 2 km, then 4 km, at most riders_per_wave each; who is never offered.
do $$
declare
  customer uuid; r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r_3km uuid; r_5km uuid;
  busy uuid; stale uuid; offline uuid; pending uuid; req uuid; o record;
begin
  customer := pg_temp.new_user('252634300001', 'customer');
  r1 := pg_temp.new_rider('252634300011'); perform pg_temp.place(r1, 0.5);
  r2 := pg_temp.new_rider('252634300012'); perform pg_temp.place(r2, 1.0);
  r3 := pg_temp.new_rider('252634300013'); perform pg_temp.place(r3, 1.5);
  r4 := pg_temp.new_rider('252634300014'); perform pg_temp.place(r4, 1.8);
  r5 := pg_temp.new_rider('252634300015'); perform pg_temp.place(r5, 1.9);
  r_3km := pg_temp.new_rider('252634300016'); perform pg_temp.place(r_3km, 3.0);
  r_5km := pg_temp.new_rider('252634300017'); perform pg_temp.place(r_5km, 5.0);
  busy := pg_temp.new_rider('252634300018'); perform pg_temp.place(busy, 0.2);
  update profiles set busy_until = now() + interval '30 minutes' where id = busy;
  stale := pg_temp.new_rider('252634300019'); perform pg_temp.place(stale, 0.2, '20 minutes');
  offline := pg_temp.new_rider('252634300020'); perform pg_temp.place(offline, 0.2, '0 seconds', false);
  pending := pg_temp.new_user('252634300021', 'rider');
  insert into rider_applications (user_id, plate, district, status) values (pending, 'XY1', 'Koodbuur', 'pending');
  perform pg_temp.place(pending, 0.1);

  req := pg_temp.request_from(customer);
  perform pg_temp.eq((select array_agg(rider_id order by distance_km) from request_offers where request_id = req and wave = 1),
                     array[r1, r2, r3, r4], 'wave 1: the 4 nearest eligible riders within 2 km, nearest first');
  perform pg_temp.eq((select count(*)::int from request_offers where request_id = req and rider_id in (busy, stale, offline, pending)), 0,
                     'busy, stale, offline and unapproved riders get no request');

  -- Not yet a minute: nothing changes.
  perform advance_moto_requests();
  perform pg_temp.eq((select count(*)::int from request_offers where request_id = req), 4, 'no second wave before wave_seconds');

  update moto_requests set created_at = now() - interval '61 seconds' where id = req;
  perform advance_moto_requests();
  perform pg_temp.eq((select array_agg(rider_id order by distance_km) from request_offers where request_id = req and wave = 2),
                     array[r5, r_3km], 'wave 2: the next riders within 4 km, not 5 km');
  perform pg_temp.eq((select wave from moto_requests where id = req), 2::smallint, 'request is on wave 2');

  -- The wave-1 rider still sees the offer, without the customer's name or number.
  perform pg_temp.act_as(r1);
  select * into o from my_request_offers() where request_id = req;
  perform pg_temp.eq(o.pickup_label, 'Jigjiga Yar', 'rider sees the pickup place');
  perform pg_temp.eq(round(o.distance_km::numeric, 1), 0.5, 'rider sees the distance to pickup');
  perform pg_temp.eq((select count(*)::int from request_offers), 1, 'riders read only their own offers');
  perform pg_temp.eq((select count(*)::int from moto_requests), 0, 'riders cannot read requests they were only offered');
  perform pg_temp.act_as_owner();

  update moto_requests set created_at = now() - interval '181 seconds' where id = req;
  perform advance_moto_requests();
  perform pg_temp.eq((select status::text from moto_requests where id = req), 'expired', 'request expires after expire_seconds');
  perform pg_temp.eq((select count(*)::int from request_offers where request_id = req and outcome = 'expired'), 6, 'all offers closed as expired');
  perform pg_temp.act_as(r1);
  perform pg_temp.eq(accept_moto_request(req), 'closed', 'an expired request cannot be accepted');
  perform pg_temp.act_as_owner();
end $$;

-- Nobody within 2 km: widen to 4 km straight away.
do $$
declare customer uuid; far uuid; req uuid;
begin
  perform pg_temp.riders_off();
  customer := pg_temp.new_user('252634300101', 'customer');
  far := pg_temp.new_rider('252634300111'); perform pg_temp.place(far, 3.5);
  req := pg_temp.request_from(customer);
  perform pg_temp.eq((select wave from request_offers where request_id = req and rider_id = far), 2::smallint,
                     'an empty first wave goes straight to wave 2');
end $$;

-- Accepting once; the job steps; the rider is busy; rating; one open request per customer.
do $$
declare customer uuid; other_customer uuid; a uuid; b uuid; outsider uuid; req uuid; req2 uuid; d record; n int;
begin
  perform pg_temp.riders_off();
  customer := pg_temp.new_user('252634300201', 'customer');
  other_customer := pg_temp.new_user('252634300202', 'customer');
  a := pg_temp.new_rider('252634300211'); perform pg_temp.place(a, 0.3);
  b := pg_temp.new_rider('252634300212'); perform pg_temp.place(b, 0.6);
  outsider := pg_temp.new_rider('252634300213'); perform pg_temp.place(outsider, 9.0);

  req := pg_temp.request_from(customer);
  perform pg_temp.act_as(customer);
  perform pg_temp.throws($q$select create_moto_request(9.56, 44.065, 'x', 9.57, 44.07, 'y', null)$q$, 'already have an open request',
                         'one open request per customer');
  perform pg_temp.throws(format($q$insert into moto_requests (customer_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng) values (%L, 9.56, 44.06, 9.57, 44.07)$q$, customer),
                         'permission denied', 'requests cannot be inserted directly');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(outsider);
  perform pg_temp.throws(format($q$select accept_moto_request(%L)$q$, req), 'request not found', 'a rider who was not offered it cannot accept');
  perform pg_temp.act_as(a);
  perform pg_temp.eq(accept_moto_request(req), 'ok', 'the first rider to accept gets it');
  perform pg_temp.act_as(b);
  perform pg_temp.eq(accept_moto_request(req), 'taken', 'the second rider is told it is taken');
  perform pg_temp.eq((select outcome from my_request_offers() where request_id = req), 'taken', 'the other rider sees "taken" briefly');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select outcome from request_offers where request_id = req and rider_id = a), 'won', 'the winner''s offer is marked won');
  perform pg_temp.eq((select rider_id from moto_requests where id = req), a, 'the request belongs to the first rider');

  -- On a job: hidden from customers, not offered new requests, busy for admins.
  perform pg_temp.act_as(other_customer);
  perform pg_temp.eq((select count(*)::int from nearby_riders(9.56, 44.065, null) where id = a), 0, 'a rider on a job is hidden from customers');
  perform pg_temp.act_as_owner();
  req2 := pg_temp.request_from(other_customer);
  perform pg_temp.eq((select count(*)::int from request_offers where request_id = req2 and rider_id = a), 0, 'a rider on a job gets no new requests');

  -- What each side sees.
  perform pg_temp.act_as(customer);
  select * into d from moto_request_detail(req);
  perform pg_temp.eq(d.rider_name, 'Test rider', 'customer sees the rider');
  perform pg_temp.eq(d.rider_phone, '252634300211', 'customer can call the rider');
  perform pg_temp.eq(d.rider_lat is not null, true, 'customer sees the rider''s position during the job');
  perform pg_temp.eq(d.customer_phone, null::text, 'the customer''s own number is not repeated to them');
  perform pg_temp.act_as(a);
  select * into d from moto_request_detail(req);
  perform pg_temp.eq(d.customer_phone, '252634300201', 'the accepted rider can call the customer');
  perform pg_temp.act_as(b);
  perform pg_temp.throws(format($q$select * from moto_request_detail(%L)$q$, req), 'request not found', 'other riders cannot see the request');
  perform pg_temp.act_as_owner();

  -- Steps in order, only by the assigned rider.
  perform pg_temp.act_as(a);
  perform pg_temp.throws(format($q$select update_request_status(%L, 'delivered')$q$, req), 'cannot change accepted to delivered', 'delivered needs picked up first');
  perform pg_temp.act_as(b);
  perform pg_temp.throws(format($q$select update_request_status(%L, 'picked_up')$q$, req), 'request not found', 'only the assigned rider moves the job');
  perform pg_temp.act_as(a);
  perform update_request_status(req, 'picked_up');
  perform pg_temp.act_as(customer);
  perform pg_temp.throws(format($q$select cancel_moto_request(%L)$q$, req), 'already picked it up', 'customer cannot cancel after pickup');
  perform pg_temp.throws(format($q$select rate_request(%L, 5)$q$, req), 'request not found', 'no rating before delivery');
  perform pg_temp.act_as(a);
  perform update_request_status(req, 'delivered');
  perform pg_temp.act_as(customer);
  perform pg_temp.eq((select can_rate from moto_request_detail(req)), true, 'customer can rate after delivery');
  perform pg_temp.eq((select rider_lat from moto_request_detail(req)), null::double precision, 'the rider''s position is hidden after delivery');
  perform pg_temp.eq(my_moto_request(), req, 'the delivered request waits for a rating');
  perform rate_request(req, 4);
  perform pg_temp.throws(format($q$select rate_request(%L, 5)$q$, req), 'request not found', 'a request is rated once');
  perform pg_temp.eq(my_moto_request(), null::uuid, 'nothing left for the customer after rating');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select stars from rider_ratings where rider_id = a and customer_id = customer), 4::smallint, 'the rating counts as the customer''s rating of the rider');
  perform pg_temp.eq(on_active_request(a), false, 'the rider is free again after delivery');

  -- A new request after delivery is fine.
  perform pg_temp.act_as(customer);
  perform create_moto_request(9.56, 44.065, 'x', 9.57, 44.07, 'y', null);
  perform pg_temp.act_as_owner();
end $$;

-- Cancelling; who may request; skipping.
do $$
declare customer uuid; rider uuid; req uuid;
begin
  perform pg_temp.riders_off();
  customer := pg_temp.new_user('252634300301', 'customer');
  rider := pg_temp.new_rider('252634300311'); perform pg_temp.place(rider, 0.4);

  perform pg_temp.act_as(rider);
  perform pg_temp.throws($q$select create_moto_request(9.56, 44.065, 'x', 9.57, 44.07, 'y', null)$q$, 'only customers', 'riders cannot request a moto');
  perform pg_temp.act_as(customer);
  perform pg_temp.throws($q$select create_moto_request(2.04, 45.34, 'Mogadishu', 2.05, 45.35, 'y', null)$q$, 'outside the service area', 'pickup must be inside the city');
  perform pg_temp.throws(format($q$select create_moto_request(9.56, 44.065, 'x', 9.57, 44.07, 'y', %L)$q$, repeat('a', 141)), 'note is too long', 'note is at most 140 characters');
  perform pg_temp.act_as_owner();

  req := pg_temp.request_from(customer);
  perform pg_temp.act_as(rider);
  perform skip_moto_request(req);
  perform pg_temp.eq((select count(*)::int from my_request_offers()), 0, 'a skipped request disappears for that rider');
  perform pg_temp.throws(format($q$select accept_moto_request(%L)$q$, req), 'request not found', 'a skipped request cannot be accepted');
  perform pg_temp.act_as(customer);
  perform cancel_moto_request(req);
  perform pg_temp.throws(format($q$select cancel_moto_request(%L)$q$, req), 'already closed', 'cancel only once');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select status::text from moto_requests where id = req), 'cancelled', 'customer can cancel while searching');
end $$;

-- Push tokens, admin list, figures and settings.
do $$
declare customer uuid; other uuid; admin_id uuid; s record;
begin
  customer := pg_temp.new_user('252634300401', 'customer');
  other := pg_temp.new_user('252634300402', 'customer');
  admin_id := pg_temp.new_user('252634300499', 'admin');

  perform pg_temp.act_as(customer);
  perform save_push_token('ExponentPushToken[test-123]', 'android', 'en');
  perform pg_temp.act_as(other);
  perform save_push_token('ExponentPushToken[test-123]', 'android', 'so');
  perform pg_temp.eq((select count(*)::int from push_tokens), 1, 'a phone''s token belongs to whoever signed in last (and only they read it)');
  perform pg_temp.act_as(customer);
  perform pg_temp.eq((select count(*)::int from push_tokens), 0, 'the previous owner no longer has the token');
  perform pg_temp.throws($q$select * from admin_requests()$q$, 'admins only', 'customers cannot list requests');
  perform pg_temp.throws($q$select admin_set_request_settings(1, 2, 3, 60, 180)$q$, 'admins only', 'customers cannot change the settings');
  perform pg_temp.eq((select count(*)::int from request_settings), 0, 'customers cannot read the settings');
  perform pg_temp.act_as_owner();
  -- No push service in a test database: sending is a no-op, never an error.
  perform pg_temp.eq(send_push(array[other], 'a', 'b', 'c', 'd', '{}'), 0, 'push without pg_net does nothing');

  insert into moto_requests (customer_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, created_at, accepted_at, expired_at)
  values (customer, 9.56, 44.06, 9.57, 44.07, 'expired', now() - interval '1 hour', null, now() - interval '57 minutes'),
         (other, 9.56, 44.06, 9.57, 44.07, 'cancelled', now() - interval '2 hours', now() - interval '119 minutes', null);
  perform pg_temp.act_as(admin_id);
  select * into s from admin_request_stats(now() - interval '1 day');
  perform pg_temp.eq(s.sent >= 2, true, 'admin sees requests sent');
  perform pg_temp.eq(s.expired >= 1, true, 'admin sees expired requests');
  perform pg_temp.eq((select count(*)::int from admin_requests() where customer_id in (customer, other)), 2, 'admin lists requests');
  perform admin_set_request_settings(1.5, 3.0, 5, 45, 150);
  perform pg_temp.throws($q$select admin_set_request_settings(3, 2, 5, 45, 150)$q$, 'request_settings', 'second radius cannot be smaller than the first');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select riders_per_wave from request_settings), 5, 'admin can change riders per wave');
end $$;
