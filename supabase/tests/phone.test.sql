-- One account per phone number (20261011000000_one_account_per_phone.sql).

do $$
declare
  admin_id uuid := pg_temp.new_user('252634600099', 'admin');
  customer uuid := pg_temp.new_user('252634600001', 'customer');
  rider uuid := pg_temp.new_rider('252634600002');
  other uuid := pg_temp.new_user('252634600003', 'customer');
  sms_user uuid;
  r record;
  pin_before text;
begin
  -- Every way of typing a number is one number.
  perform pg_temp.eq(canonical_phone('4421785'), '252634421785', '7 digits get 63');
  perform pg_temp.eq(canonical_phone('634421785'), '252634421785', 'national number');
  perform pg_temp.eq(canonical_phone('0634421785'), '252634421785', 'leading 0 dropped');
  perform pg_temp.eq(canonical_phone('+252 63 442 1785'), '252634421785', '+252 with spaces');
  perform pg_temp.eq(canonical_phone('00252634421785'), '252634421785', '00252');
  perform pg_temp.eq(canonical_phone(''), null::text, 'empty is no number');

  -- A second account can't hold the same number in another form, in profiles or PIN credentials.
  perform pg_temp.throws(format($q$update profiles set phone = '+252 63 460 0001' where id = %L$q$, other), 'duplicate key', 'profiles: one account per number');
  perform pg_temp.throws(format($q$update pin_credentials set phone = '0634600001' where user_id = %L$q$, other), 'duplicate key', 'PIN credentials: one account per number');
  -- Plates may be shared.
  insert into rider_applications (user_id, plate, district) values (other, 'AB123', 'Koodbuur');
  delete from rider_applications where user_id = other;

  -- Sign-up's check covers every form and every place a number lives.
  perform pg_temp.eq(pin_phone_available('4600001'), false, 'taken: 7-digit form of an existing number');
  perform pg_temp.eq(pin_phone_available('+252634600001'), false, 'taken: +252 form');
  perform pg_temp.eq(pin_phone_available('252634699999'), true, 'free number');
  insert into auth.users (phone) values ('252634611111') returning id into sms_user;   -- an older SMS login, no profile yet
  perform pg_temp.eq(pin_phone_available('634611111'), false, 'taken: an SMS login with that number');
  perform pg_temp.eq((select count(*)::int from phone_conflicts()), 0, 'no conflicts so far');

  -- Conflicts already in the data are reported, not merged.
  update auth.users set phone = '252634600001' where id = sms_user;
  select * into r from phone_conflicts();
  perform pg_temp.eq(r.phone, '252634600001', 'conflict reported by number');
  perform pg_temp.eq(cardinality(r.user_ids), 2, 'both accounts listed');
  perform pg_temp.eq((select count(*)::int from auth.users where id in (customer, sms_user)), 2, 'nothing deleted');
  update auth.users set phone = '252634611111' where id = sms_user;

  -- Only admins correct numbers; customers and riders can't call the checks either.
  perform pg_temp.act_as(rider);
  perform pg_temp.throws(format($q$select * from admin_change_phone(%L, '634699999')$q$, rider), 'admins only', 'riders cannot change their number');
  perform pg_temp.throws($q$select pin_phone_available('634699999')$q$, 'permission denied', 'riders cannot probe numbers');
  perform pg_temp.throws($q$select * from phone_conflicts()$q$, 'permission denied', 'riders cannot list conflicts');
  perform pg_temp.eq((select count(*)::int from phone_changes), 0, 'riders cannot read phone changes');
  perform pg_temp.act_as(customer);
  perform pg_temp.throws($q$select pin_phone_available('634699999')$q$, 'permission denied', 'customers cannot probe numbers');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(admin_id);
  perform pg_temp.throws(format($q$select * from admin_change_phone(%L, '63442178')$q$, rider), 'invalid phone', 'a digit short is refused');
  perform pg_temp.throws(format($q$select * from admin_change_phone(%L, '+252 63 460 0001')$q$, rider), 'phone taken', 'another account has it (other form)');
  perform pg_temp.throws(format($q$select * from admin_change_phone(%L, '4611111')$q$, rider), 'phone taken', 'an SMS login has it');
  perform pg_temp.throws(format($q$select * from admin_change_phone(%L, '0634600002')$q$, rider), 'same number', 'same number in another form');
  perform pg_temp.act_as_owner();

  -- A rider's correction: everywhere at once, PIN and history kept, number confirmed again.
  update rider_applications set phone_verified_at = now(), phone_verified_number = '252634600002', rider_number = 7 where user_id = rider;
  update profiles set is_online = true, last_seen_at = now() where id = rider;
  insert into auth.sessions (user_id) values (rider);
  insert into calls (caller_id, rider_id) values (customer, rider);
  select pin_hash into pin_before from pin_credentials where user_id = rider;

  perform pg_temp.act_as(admin_id);
  select * into r from admin_change_phone(rider, '4699999');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((r.old_phone, r.new_phone, r.rider_reset), ('252634600002'::text, '252634699999'::text, true), 'result');
  perform pg_temp.eq((select email from auth.users where id = rider), '252634699999@pin.jareeye.app', 'login address');
  perform pg_temp.eq((select phone from pin_credentials where user_id = rider), '252634699999', 'PIN credential');
  perform pg_temp.eq((select pin_hash from pin_credentials where user_id = rider), pin_before, 'PIN kept');
  perform pg_temp.eq((select phone from profiles where id = rider), '252634699999', 'profile');
  perform pg_temp.eq((select (status, phone_verified_at, rider_number) from rider_applications where user_id = rider),
    ('pending'::application_status, null::timestamptz, 7), 'confirm again; JRY-007 kept');
  perform pg_temp.eq((select is_online from profiles where id = rider), false, 'offline until approved again');
  perform pg_temp.eq((select count(*)::int from auth.sessions where user_id = rider), 0, 'signed out');
  perform pg_temp.eq((select count(*)::int from calls where rider_id = rider), 1, 'history kept');
  perform pg_temp.eq((select (old_phone, new_phone, changed_by) from phone_changes where user_id = rider),
    ('252634600002'::text, '252634699999'::text, admin_id), 'audited');
  perform pg_temp.eq((select outcome from pin_login('252634699999', '1234', null)), 'ok', 'signs in with the new number and old PIN');
  perform pg_temp.eq(pin_phone_available('634600002'), true, 'the old number is free again');

  -- A customer's correction doesn't touch rider fields.
  perform pg_temp.act_as(admin_id);
  select * into r from admin_change_phone(customer, '634600011');
  perform pg_temp.eq(r.rider_reset, false, 'customers have nothing to confirm');
  perform pg_temp.eq((select count(*)::int from phone_changes), 2, 'admins read the audit');
  perform pg_temp.act_as_owner();
end $$;
