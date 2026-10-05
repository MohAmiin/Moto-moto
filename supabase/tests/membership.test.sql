-- Rider memberships (20261010000000_rider_membership.sql): free mode, grace on first activation only,
-- payments and renewals, duplicate protection, expiry boundaries, enforcement and permissions.
-- now() is fixed inside the test transaction, so expiry boundaries are set relative to it.

create function pg_temp.go_online(p_rider uuid) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(p_rider);
  update profiles set is_online = true, last_seen_at = now(), lat = 9.56, lng = 44.07, busy_until = null where id = p_rider;
  perform pg_temp.act_as_owner();
end;
$$;

create function pg_temp.go_offline(p_rider uuid) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(p_rider);
  update profiles set is_online = false where id = p_rider;
  perform pg_temp.act_as_owner();
end;
$$;

-- Whether a customer finds the rider.
create function pg_temp.visible(p_rider uuid, p_customer uuid) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform pg_temp.act_as(p_customer);
  select exists (select 1 from nearby_riders(9.56, 44.07, null) n where n.id = p_rider) into v;
  perform pg_temp.act_as_owner();
  return v;
end;
$$;

create function pg_temp.status(p_rider uuid) returns text language sql as $$
  select status from membership_status_of(p_rider);
$$;

create function pg_temp.expiry(p_rider uuid) returns timestamptz language sql as $$
  select expires_at from rider_memberships where user_id = p_rider;
$$;

do $$
declare
  admin_id uuid := pg_temp.new_user('252634500099', 'admin');
  customer uuid := pg_temp.new_user('252634500001', 'customer');
  early uuid := pg_temp.new_rider('252634500002');   -- approved before the switch is first turned on
  paid uuid := pg_temp.new_rider('252634500003');    -- already has a long paid membership then
  pending uuid := pg_temp.new_user('252634500004', 'rider');
  late uuid;                                          -- approved after the switch is on
  s record;
  r record;
  req uuid := gen_random_uuid();
  n int;
begin
  insert into rider_applications (user_id, plate, district) values (pending, 'PD001', 'Koodbuur');

  -- Free mode (default): nothing changes for riders.
  perform pg_temp.eq((select required from membership_settings), false, 'membership is off by default');
  perform pg_temp.eq((select price_usd from membership_settings), 1.00, 'intended price: $1 per 30 days');
  perform pg_temp.eq(pg_temp.status(early), 'free', 'status is free while off');
  perform pg_temp.go_online(early);
  perform pg_temp.eq(pg_temp.visible(early, customer), true, 'free mode: approved rider goes online and is found');
  perform pg_temp.go_offline(early);

  -- Payments can be recorded while off (kept in history, no effect on going online).
  perform pg_temp.act_as(admin_id);
  select * into r from admin_confirm_membership_payment(paid, 12.50, 'evc_plus', 'EVC 123', null, gen_random_uuid());
  perform pg_temp.eq(r.period_start, now(), 'first payment starts now');
  perform pg_temp.act_as_owner();
  update rider_memberships set expires_at = now() + interval '50 days' where user_id = paid;

  -- Only admins change settings or record payments; customers and riders read nothing private.
  perform pg_temp.act_as(early);
  perform pg_temp.throws($q$select * from admin_set_membership_settings(true, 10, null)$q$, 'admins only', 'riders cannot turn it on');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'cash', null, null, gen_random_uuid())$q$, early), 'admins only', 'riders cannot pay themselves');
  perform pg_temp.throws(format($q$select * from admin_membership_history(%L)$q$, early), 'admins only', 'riders cannot read payment history');
  perform pg_temp.throws($q$select * from admin_rider_memberships()$q$, 'admins only', 'riders cannot list memberships');
  perform pg_temp.throws(format($q$insert into rider_memberships (user_id, expires_at) values (%L, now() + interval '1 year')$q$, early), 'permission denied', 'riders cannot grant themselves time');
  perform pg_temp.throws(format($q$update rider_memberships set expires_at = now() + interval '1 year' where user_id = %L$q$, paid), 'permission denied', 'riders cannot extend their time');
  perform pg_temp.eq((select count(*)::int from membership_payments), 0, 'riders see no payment records');
  perform pg_temp.eq((select count(*)::int from membership_settings), 0, 'riders cannot read the settings table');
  perform pg_temp.act_as(customer);
  perform pg_temp.eq((select count(*)::int from membership_payments), 0, 'customers see no payment records');
  perform pg_temp.eq((select count(*)::int from rider_memberships), 0, 'customers see no memberships');
  perform pg_temp.throws($q$select membership_ok(gen_random_uuid())$q$, 'permission denied', 'membership_ok is internal');
  perform pg_temp.act_as_owner();

  -- Turning it on needs a price; there is no default.
  perform pg_temp.act_as(admin_id);
  perform pg_temp.throws($q$select * from admin_set_membership_settings(true, null, null)$q$, 'price required', 'no price, no switch');
  perform pg_temp.throws($q$select * from admin_set_membership_settings(true, 0, null)$q$, 'invalid price', 'price must be positive');

  -- First activation: 30 days' grace for approved riders, once; pending riders and longer memberships untouched.
  select * into s from admin_set_membership_settings(true, 10, 'Pay by EVC to 63 000 0000');
  perform pg_temp.eq(s.grace_given, 1, 'grace for the one approved rider without a longer membership');
  perform pg_temp.eq(pg_temp.expiry(early), now() + interval '30 days', 'grace is 30 days');
  perform pg_temp.eq(pg_temp.expiry(paid), now() + interval '50 days', 'a longer paid membership is kept');
  perform pg_temp.eq(pg_temp.expiry(pending), null::timestamptz, 'pending riders get no grace');
  perform pg_temp.eq((select count(*)::int from membership_payments where kind = 'grace' and user_id = early and confirmed_by = admin_id), 1, 'grace is recorded with who turned it on');

  -- Off and on again: no second grace.
  perform admin_set_membership_settings(false, 10, null);
  perform pg_temp.throws(format($q$update rider_memberships set expires_at = now() - interval '1 day' where user_id = %L$q$, early),
    'permission denied', 'admins change expiries only by recording payments');
  perform pg_temp.act_as_owner();
  update rider_memberships set expires_at = now() - interval '1 day' where user_id = early;  -- the grace has run out
  perform pg_temp.act_as(admin_id);
  select * into s from admin_set_membership_settings(true, 10, 'Pay by EVC');
  perform pg_temp.eq(s.grace_given, 0, 'turning it on again gives no grace');
  perform pg_temp.eq(pg_temp.expiry(early), now() - interval '1 day', 'expired rider stays expired');
  perform pg_temp.eq((select count(*)::int from membership_payments where kind = 'grace'), 1, 'still one grace record');
  perform pg_temp.act_as_owner();

  -- Riders approved after activation are unpaid: they can't go online and aren't found.
  late := pg_temp.new_rider('252634500005');
  perform pg_temp.eq(pg_temp.status(late), 'unpaid', 'newly approved rider is unpaid');
  perform pg_temp.throws(format($q$select pg_temp.go_online(%L)$q$, late), 'membership required', 'unpaid rider cannot go online');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq(pg_temp.status(early), 'expired', 'expired after the grace');
  perform pg_temp.throws(format($q$select pg_temp.go_online(%L)$q$, early), 'membership required', 'expired rider cannot go online');
  perform pg_temp.act_as_owner();

  -- A payment for an unpaid rider starts now and doesn't put them online.
  perform pg_temp.act_as(admin_id);
  select * into r from admin_confirm_membership_payment(late, 10, 'cash', null, null, req);
  perform pg_temp.eq(r.duplicate, false, 'first confirmation counts');
  perform pg_temp.eq(r.period_end, now() + interval '30 days', 'unpaid: 30 days from now');
  perform pg_temp.eq((select is_online from profiles where id = late), false, 'paying does not put the rider online');

  -- Retrying with the same request changes nothing.
  select * into r from admin_confirm_membership_payment(late, 10, 'cash', null, null, req);
  perform pg_temp.eq(r.duplicate, true, 'same request is a duplicate');
  perform pg_temp.eq(pg_temp.expiry(late), now() + interval '30 days', 'duplicate adds no time');
  perform pg_temp.eq((select count(*)::int from membership_payments where user_id = late), 1, 'one payment row');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'cash', null, null, %L)$q$, early, req), 'request id already used', 'a request id belongs to one rider');
  -- A second tap moments later (new request id, same amount and reference) is refused.
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'cash', null, null, gen_random_uuid())$q$, late), 'possible duplicate', 'double tap refused');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 0, 'cash', null, null, gen_random_uuid())$q$, late), 'invalid amount', 'amount must be positive');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'cash', null, null, gen_random_uuid())$q$, customer), 'not a rider', 'only riders have memberships');
  perform pg_temp.act_as_owner();

  perform pg_temp.go_online(late);
  perform pg_temp.eq(pg_temp.visible(late, customer), true, 'paid rider is found');

  -- Early renewal adds 30 days to the current expiry.
  update rider_memberships set expires_at = now() + interval '10 days' where user_id = late;
  update membership_payments set confirmed_at = now() - interval '1 hour' where user_id = late;
  perform pg_temp.act_as(admin_id);
  select * into r from admin_confirm_membership_payment(late, 10, 'zaad', 'renew', null, gen_random_uuid());
  perform pg_temp.eq(r.period_start, now() + interval '10 days', 'early renewal starts at the old expiry');
  perform pg_temp.eq(pg_temp.expiry(late), now() + interval '40 days', 'early renewal adds 30 days');
  perform pg_temp.eq((select previous_expires_at from membership_payments where reference = 'renew'), now() + interval '10 days', 'audit keeps the previous expiry');
  perform pg_temp.eq((select confirmed_by from membership_payments where reference = 'renew'), admin_id, 'audit keeps who confirmed');

  -- References: credited once, to anyone, whatever the spacing or case; per provider; bank per account.
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'zaad', ' re-new ', null, gen_random_uuid())$q$, early),
    'reference already used', 'a reference already credited to another rider is refused');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'zaad', 'RENEW', null, gen_random_uuid())$q$, late),
    'reference already used', 'or to the same rider again later');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'zaad', null, null, gen_random_uuid())$q$, early),
    'reference required', 'mobile money needs a reference');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'card', 'X1', null, gen_random_uuid())$q$, early),
    'invalid method', 'unknown methods are refused');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 10, 'bank', 'TT-55', null, gen_random_uuid())$q$, early),
    'receiving account required', 'bank needs the receiving account');
  select * into r from admin_confirm_membership_payment(paid, 1, 'edahab', 'renew', null, gen_random_uuid());
  perform pg_temp.eq(r.duplicate, false, 'the same reference at another provider is a different payment');
  select * into r from admin_confirm_membership_payment(paid, 1, 'bank', 'TT-55', 'Dahabshiil 123', gen_random_uuid());
  select * into r from admin_confirm_membership_payment(paid, 1, 'bank', 'TT-55', 'Premier 9', gen_random_uuid());
  perform pg_temp.eq(r.duplicate, false, 'bank references are per receiving account');
  perform pg_temp.throws(format($q$select * from admin_confirm_membership_payment(%L, 1, 'bank', 'tt 55', 'dahabshiil-123', gen_random_uuid())$q$, paid),
    'reference already used', 'same bank account and reference is refused');
  -- Retrying a successful request returns the original, even though its reference now exists.
  select * into r from admin_confirm_membership_payment(late, 10, 'zaad', 'renew', null,
    (select request_id from membership_payments where reference = 'renew' and method = 'zaad'));
  perform pg_temp.eq(r.duplicate, true, 'retry of a referenced payment is idempotent');
  perform pg_temp.eq(r.period_end, now() + interval '40 days', 'retry returns the original dates');
  perform pg_temp.eq((select method from membership_payments where reference = 'renew' and method = 'zaad'), 'zaad', 'method is recorded');

  -- Late renewal starts from now.
  select * into r from admin_confirm_membership_payment(early, 10, 'cash', null, null, gen_random_uuid());
  perform pg_temp.eq(r.period_start, now(), 'late renewal starts now');
  perform pg_temp.eq(pg_temp.expiry(early), now() + interval '30 days', 'late renewal gives 30 days from now');
  perform pg_temp.act_as_owner();

  -- Expiry boundaries (server time).
  update rider_memberships set expires_at = now() + interval '1 second' where user_id = late;
  perform pg_temp.eq(pg_temp.status(late), 'expiring', 'one second left is expiring');
  perform pg_temp.eq(pg_temp.visible(late, customer), true, 'still found with one second left');
  update rider_memberships set expires_at = now() where user_id = late;
  perform pg_temp.eq(pg_temp.status(late), 'expired', 'expiry at exactly now is expired');
  perform pg_temp.eq(pg_temp.visible(late, customer), false, 'online rider disappears once expired, with the app closed');
  perform pg_temp.eq((select is_online from profiles where id = late), true, 'the database still has them online; discovery hides them');
  update rider_memberships set expires_at = now() + interval '3 days' where user_id = late;
  perform pg_temp.eq(pg_temp.status(late), 'expiring', 'three days left is expiring');
  perform pg_temp.eq((select days_left from membership_status_of(late)), 3, 'three days left');
  update rider_memberships set expires_at = now() + interval '3 days 1 second' where user_id = late;
  perform pg_temp.eq(pg_temp.status(late), 'active', 'just over three days is active');
  perform pg_temp.eq((select days_left from membership_status_of(late)), 4, 'days left round up');

  -- Heartbeats keep working while online (only going online is checked), and other rules still apply.
  perform pg_temp.act_as(late);
  update profiles set last_seen_at = now() where id = late and is_online;
  get diagnostics n = row_count;
  perform pg_temp.eq(n, 1, 'heartbeat still saves');
  update profiles set busy_until = now() + interval '45 minutes' where id = late;
  perform pg_temp.act_as_owner();
  perform pg_temp.eq(pg_temp.visible(late, customer), false, 'busy riders stay hidden');
  update profiles set busy_until = null, last_seen_at = now() - interval '11 minutes' where id = late;
  perform pg_temp.eq(pg_temp.visible(late, customer), false, 'stale riders stay hidden');
  update profiles set last_seen_at = now() where id = late;
  perform pg_temp.eq(pg_temp.visible(late, customer), true, 'fresh, free, paid rider is found');

  -- Admins still see riders reporting online, with why customers can't: busy, or membership.
  update rider_memberships set expires_at = now() - interval '1 second' where user_id = late;
  perform pg_temp.act_as(admin_id);
  select * into r from admin_online_riders() o where o.id = late;
  perform pg_temp.eq(r.available, false, 'expired rider is reporting online but not available');
  perform pg_temp.eq(r.membership_status, 'expired', 'labelled expired');
  perform pg_temp.eq((select count(*)::int from nearby_riders(9.56, 44.07, null) n where n.id = late), 0, 'admins get customer discovery as customers do');
  perform pg_temp.act_as_owner();
  update rider_memberships set expires_at = now() + interval '3 days 1 second' where user_id = late;
  update profiles set busy_until = now() + interval '20 minutes' where id = late;
  perform pg_temp.act_as(admin_id);
  select * into r from admin_online_riders() o where o.id = late;
  perform pg_temp.eq((r.is_busy, r.available), (true, false), 'busy rider: reporting online, not available');
  perform pg_temp.act_as_owner();
  update profiles set busy_until = null, last_seen_at = now() - interval '11 minutes' where id = late;
  perform pg_temp.act_as(admin_id);
  perform pg_temp.eq((select count(*)::int from admin_online_riders() o where o.id = late), 0, 'stale riders are not reporting online');
  perform pg_temp.act_as(customer);
  perform pg_temp.throws($q$select * from admin_online_riders()$q$, 'admins only', 'customers cannot list riders reporting online');
  perform pg_temp.act_as(late);
  perform pg_temp.throws($q$select * from admin_online_riders()$q$, 'admins only', 'riders cannot either');
  perform pg_temp.act_as_owner();
  update profiles set last_seen_at = now() where id = late;

  -- Rider's own view, and the admin list.
  perform pg_temp.act_as(late);
  select * into r from my_membership();
  perform pg_temp.eq(r.status, 'active', 'rider sees own status');
  perform pg_temp.eq(r.instructions, 'Pay by EVC', 'rider sees payment instructions');
  perform pg_temp.eq(r.price_usd, 10.00, 'rider sees the price');
  perform pg_temp.act_as(admin_id);
  perform pg_temp.eq((select count(*)::int from admin_rider_memberships()), 4, 'admin lists every rider application');
  perform pg_temp.eq((select count(*)::int from admin_membership_history(late)), 2, 'history has both payments');
  perform pg_temp.eq((select price_usd from membership_settings), 10.00, 'price as set');
  perform pg_temp.act_as_owner();

  -- Turning it off again: expired riders can go online and be found; history stays.
  update rider_memberships set expires_at = now() - interval '1 day' where user_id = late;
  perform pg_temp.go_offline(late);
  perform pg_temp.act_as(admin_id);
  perform admin_set_membership_settings(false, 10, 'Pay by EVC');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq(pg_temp.status(late), 'free', 'free again when off');
  perform pg_temp.go_online(late);
  perform pg_temp.eq(pg_temp.visible(late, customer), true, 'off: expired rider is found again');
  perform pg_temp.eq((select count(*)::int from membership_payments), 8, 'history kept while off');

  -- A rider deleting their account: their membership goes, the payment records stay without the link.
  delete from auth.users where id = late;
  perform pg_temp.eq(pg_temp.expiry(late), null::timestamptz, 'membership removed with the account');
  perform pg_temp.eq((select count(*)::int from membership_payments where user_id is null and kind = 'payment'), 2, 'payments kept, unlinked');
end $$;
