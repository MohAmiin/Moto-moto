-- Approval needs an admin-confirmed call to the rider's number (20261008000000_rider_phone_verification.sql).

do $$
declare rider uuid; admin_id uuid; other_admin uuid; c record; v record; a rider_applications;
begin
  rider := pg_temp.new_user('252634100001', 'rider');
  admin_id := pg_temp.new_user('252634100099', 'admin');
  insert into rider_applications (user_id, plate, district) values (rider, 'HG001', 'Koodbuur');

  -- Without a confirmed call, approval is refused; rejection still works.
  perform pg_temp.act_as(admin_id);
  perform pg_temp.throws(format($q$select review_rider(%L, true)$q$, rider), 'phone not verified', 'no approval without a confirmed call');
  select * into v from admin_confirm_rider_phone(rider, '123456');
  perform pg_temp.eq(v.outcome, 'no_code', 'nothing to confirm before the rider gets a code');
  perform pg_temp.act_as_owner();

  -- The rider gets a code; only admins can confirm it.
  perform pg_temp.act_as(rider);
  select * into c from rider_phone_code();
  perform pg_temp.eq(c.code ~ '^[0-9]{6}$', true, 'rider gets a 6-digit code');
  perform pg_temp.throws(format($q$select * from admin_confirm_rider_phone(%L, %L)$q$, rider, c.code), 'admins only', 'riders cannot confirm themselves');
  perform pg_temp.throws(format($q$select review_rider(%L, true)$q$, rider), 'admins only', 'riders cannot approve themselves');
  perform pg_temp.throws($q$select * from rider_phone_checks$q$, 'permission denied', 'riders cannot read code hashes');
  update rider_applications set phone_verified_at = now(), phone_verified_number = '252634100001' where user_id = rider;
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select phone_verified_at from rider_applications where user_id = rider), null::timestamptz,
    'riders cannot mark their own number as verified');

  perform pg_temp.act_as(admin_id);
  select * into v from admin_confirm_rider_phone(rider, case when c.code = '000000' then '000001' else '000000' end);
  perform pg_temp.eq(v.outcome, 'wrong_code', 'a wrong code is refused');
  perform pg_temp.eq(v.checks_left, 4, 'wrong codes are counted');
  select * into v from admin_confirm_rider_phone(rider, c.code);
  perform pg_temp.eq(v.outcome, 'confirmed', 'the right code confirms the number');
  select * into v from admin_confirm_rider_phone(rider, c.code);
  perform pg_temp.eq(v.outcome, 'no_code', 'a code works once');
  perform review_rider(rider, true);
  perform pg_temp.act_as_owner();

  select * into a from rider_applications where user_id = rider;
  perform pg_temp.eq(a.status, 'approved'::application_status, 'approved after confirmation');
  perform pg_temp.eq(a.phone_verified_by, admin_id, 'who confirmed is recorded');
  perform pg_temp.eq(a.phone_verified_at is not null, true, 'when it was confirmed is recorded');
  perform pg_temp.eq(a.phone_verified_number, '252634100001', 'which number was confirmed is recorded');

  -- If the number is changed (only possible from the SQL editor), approving again needs a new confirmation.
  other_admin := pg_temp.new_user('252634100098', 'admin');
  update profiles set phone = '252634100002' where id = rider;
  perform pg_temp.act_as(other_admin);
  perform pg_temp.throws(format($q$select review_rider(%L, true)$q$, rider), 'phone not verified', 'a changed number needs a new check');
  perform pg_temp.act_as_owner();
end $$;

-- Wrong codes are limited and codes expire.
do $$
declare rider uuid; admin_id uuid; c record; v record;
begin
  rider := pg_temp.new_user('252634100003', 'rider');
  admin_id := pg_temp.new_user('252634100097', 'admin');
  insert into rider_applications (user_id, plate, district) values (rider, 'HG003', 'Koodbuur');
  perform pg_temp.act_as(rider);
  select * into c from rider_phone_code();
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(admin_id);
  for i in 1..4 loop perform admin_confirm_rider_phone(rider, 'abcdef'); end loop;
  select * into v from admin_confirm_rider_phone(rider, 'abcdef');
  perform pg_temp.eq(v.outcome, 'failed', 'five wrong codes use the code up');
  select * into v from admin_confirm_rider_phone(rider, c.code);
  perform pg_temp.eq(v.outcome, 'failed', 'the right code no longer works after five wrong ones');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(rider);
  select * into c from rider_phone_code();
  perform pg_temp.act_as_owner();
  update rider_phone_checks set expires_at = now() - interval '1 second' where user_id = rider;
  perform pg_temp.act_as(admin_id);
  select * into v from admin_confirm_rider_phone(rider, c.code);
  perform pg_temp.eq(v.outcome, 'expired', 'expired codes are refused');
  perform pg_temp.act_as_owner();

  -- Codes are limited to 10 an hour (one was used above, then one more).
  perform pg_temp.act_as(rider);
  for i in 1..8 loop perform rider_phone_code(); end loop;
  perform pg_temp.throws($q$select * from rider_phone_code()$q$, 'Too many codes', 'at most 10 codes an hour');
  perform pg_temp.act_as_owner();
end $$;

-- Riders can't fill in review fields, and a rejected rider can resubmit (this used to fail).
do $$
declare rider uuid; admin_id uuid; a rider_applications;
begin
  rider := pg_temp.new_user('252634100004', 'rider');
  admin_id := pg_temp.new_user('252634100096', 'admin');

  perform pg_temp.act_as(rider);
  perform pg_temp.throws(format($q$insert into rider_applications (user_id, plate, district, phone_verified_at) values (%L, 'X1', 'Koodbuur', now())$q$, rider),
    'set by admins', 'a new application cannot come pre-verified');
  insert into rider_applications (user_id, plate, district) values (rider, 'HG004', 'Koodbuur');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(admin_id);
  perform review_rider(rider, false);
  perform pg_temp.act_as_owner();

  -- Resubmitting can't sneak in a verification either.
  perform pg_temp.act_as(rider);
  perform pg_temp.throws(format($q$update rider_applications set status = 'pending', phone_verified_at = now() where user_id = %L$q$, rider),
    'set by admins', 'a resubmission cannot mark the number as verified');
  perform pg_temp.act_as_owner();

  -- The app's resubmission: the same fields it sends, status back to pending.
  perform pg_temp.act_as(rider);
  update rider_applications set plate = 'HG004B', district = '26 June', status = 'pending' where user_id = rider;
  perform pg_temp.act_as_owner();
  select * into a from rider_applications where user_id = rider;
  perform pg_temp.eq(a.status, 'pending'::application_status, 'rejected riders can resubmit');
  perform pg_temp.eq(a.reviewed_by, null::uuid, 'resubmitting clears the old review');

  -- Row-level security ignores the edit (no row matches the rider's update policy).
  perform pg_temp.act_as(rider);
  update rider_applications set status = 'approved' where user_id = rider;
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select status from rider_applications where user_id = rider), 'pending'::application_status,
    'riders cannot approve themselves by editing the row');
end $$;

-- Riders approved before this change keep their approval.
do $$
declare rider uuid;
begin
  rider := pg_temp.new_rider('252634100005');
  perform pg_temp.eq((select status from rider_applications where user_id = rider), 'approved'::application_status, 'existing approvals stay');
end $$;
