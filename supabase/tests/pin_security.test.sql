-- PIN sign-in limits, 6-digit PINs and PIN reset requests (20261007000000_pin_security.sql).

-- Existing 4-digit accounts keep working; wrong PINs and unknown numbers look the same.
do $$
declare u uuid; r record;
begin
  u := pg_temp.new_user('252634000001', 'customer', '1234');
  select * into r from pin_login('252634000001', '1234', '10.0.0.1');
  perform pg_temp.eq(r.outcome, 'ok', 'legacy 4-digit PIN signs in');
  perform pg_temp.eq(r.user_id, u, 'legacy sign-in returns the account');
  select * into r from pin_login('252634000001', '001234', '10.0.0.1');
  perform pg_temp.eq(r.outcome, 'wrong', 'a legacy account does not accept a padded 6-digit PIN');
  select * into r from pin_login('252639999999', '1234', '10.0.0.1');
  perform pg_temp.eq(r.outcome, 'wrong', 'unknown number answers "wrong", not "no account"');
  select * into r from pin_login('252634000001', '12a4', '10.0.0.1');
  perform pg_temp.eq(r.outcome, 'invalid', 'malformed PIN is rejected before counting');
end $$;

-- Five wrong PINs lock the number; locks double; a correct PIN during a lock is refused.
do $$
declare r record; g pin_login_guard;
begin
  perform pg_temp.new_user('252634000002', 'customer', '4321');
  for i in 1..4 loop
    select * into r from pin_login('252634000002', '0000', '10.0.0.2');
    perform pg_temp.eq(r.outcome, 'wrong', 'tries 1-4 are just wrong');
  end loop;
  select * into r from pin_login('252634000002', '0000', '10.0.0.2');
  perform pg_temp.eq(r.outcome, 'locked', 'the 5th wrong PIN locks');
  perform pg_temp.eq(r.retry_after_seconds between 899 and 900, true, 'first lock is 15 minutes');
  select * into r from pin_login('252634000002', '4321', '10.0.0.2');
  perform pg_temp.eq(r.outcome, 'locked', 'the right PIN is refused while locked');

  update pin_login_guard set locked_until = now() - interval '1 second' where phone = '252634000002';
  select * into r from pin_login('252634000002', '0000', '10.0.0.2');
  perform pg_temp.eq(r.outcome, 'locked', 'a wrong PIN after a lock locks again at once');
  perform pg_temp.eq(r.retry_after_seconds between 1799 and 1800, true, 'second lock is 30 minutes');

  update pin_login_guard set failed_attempts = 20, locked_until = now() - interval '1 second' where phone = '252634000002';
  select * into r from pin_login('252634000002', '0000', '10.0.0.2');
  perform pg_temp.eq(r.retry_after_seconds, 86400, 'locks stop growing at 24 hours');

  update pin_login_guard set locked_until = now() - interval '1 second' where phone = '252634000002';
  select * into r from pin_login('252634000002', '4321', '10.0.0.2');
  perform pg_temp.eq(r.outcome, 'ok', 'the right PIN works once the lock ends');
  select * into g from pin_login_guard where phone = '252634000002';
  perform pg_temp.eq(g.failed_attempts, 0, 'a success clears the count');
end $$;

-- Guessing an unknown number is limited the same way; a day without mistakes starts the count again.
do $$
declare r record;
begin
  for i in 1..5 loop select * into r from pin_login('252630000000', '123456', '10.0.0.3'); end loop;
  perform pg_temp.eq(r.outcome, 'locked', 'unknown numbers lock too');

  perform pg_temp.new_user('252634000004', 'customer', '1111');
  for i in 1..4 loop select * into r from pin_login('252634000004', '0000', '10.0.0.4'); end loop;
  update pin_login_guard set last_failed_at = now() - interval '25 hours' where phone = '252634000004';
  select * into r from pin_login('252634000004', '0000', '10.0.0.4');
  perform pg_temp.eq(r.outcome, 'wrong', 'old mistakes are forgotten after 24 hours');
end $$;

-- One internet address gets at most 50 wrong PINs an hour across all numbers.
do $$
declare r record;
begin
  perform pg_temp.new_user('252634000005', 'customer', '2222');
  insert into auth_rate_limits (bucket, key, window_start, hits) values ('signin-fail-ip', '10.9.9.9', now(), 50);
  select * into r from pin_login('252634000005', '2222', '10.9.9.9');
  perform pg_temp.eq(r.outcome, 'ip_limited', 'busy address is held back even with the right PIN');
  select * into r from pin_login('252634000005', '2222', '10.0.0.5');
  perform pg_temp.eq(r.outcome, 'ok', 'other addresses are unaffected');
end $$;

-- Only the pin-auth function (service role) can check PINs or start resets.
do $$
begin
  perform pg_temp.act_as(null, 'anon');
  perform pg_temp.throws($q$select * from pin_login('252634000001', '1234')$q$, 'permission denied', 'anon cannot check PINs');
  perform pg_temp.throws($q$select * from pin_reset_request('252634000001', '123456')$q$, 'permission denied', 'anon cannot request resets directly');
  perform pg_temp.throws($q$select consume_rate_limit('x', 'y', 1, interval '1 hour')$q$, 'permission denied', 'anon cannot touch limits');
  perform pg_temp.act_as_owner();
  perform pg_temp.act_as(pg_temp.new_user('252634000006', 'customer'));
  perform pg_temp.throws($q$select * from pin_login('252634000001', '1234')$q$, 'permission denied', 'signed-in users cannot check PINs');
  perform pg_temp.throws($q$select * from pin_credentials$q$, 'permission denied', 'nobody reads PIN hashes');
  perform pg_temp.throws($q$select * from pin_reset_requests$q$, 'permission denied', 'nobody reads reset requests');
  perform pg_temp.act_as_owner();
  perform pg_temp.act_as(null, 'service_role');
  perform * from pin_login('252634000001', '1234', '10.0.0.6');
  perform pg_temp.act_as_owner();
end $$;

-- New accounts: a 6-digit PIN replaces the random creation password, once, and only for that number.
do $$
declare u uuid; old_u uuid; r record;
begin
  insert into auth.users (email, encrypted_password)
  values ('252634000007@pin.jareeye.app', crypt(gen_random_uuid()::text, gen_salt('bf', 4))) returning id into u;
  perform pg_temp.eq((select scheme from pin_credentials where user_id = u), 'legacy4', 'the copy trigger saw the random password');
  perform pin_set_credential(u, '252634000007', '135790');
  select * into r from pin_login('252634000007', '135790', '10.0.0.7');
  perform pg_temp.eq(r.outcome, 'ok', 'new 6-digit PIN signs in');
  perform pg_temp.throws(format($q$select pin_set_credential(%L, '252634000007', '111111')$q$, u), 'credential already set', 'a PIN cannot be set twice');
  perform pg_temp.throws(format($q$select pin_set_credential(%L, '252634000008', '111111')$q$, u), 'does not match', 'phone must match the account');
  perform pg_temp.throws(format($q$select pin_set_credential(%L, '252634000007', '1234')$q$, u), 'invalid pin', 'new PINs have 6 digits');

  old_u := pg_temp.new_user('252634000009', 'customer', '9999');
  update auth.users set created_at = now() - interval '1 day' where id = old_u;
  update pin_credentials set updated_at = now() - interval '1 day' where user_id = old_u;
  perform pg_temp.throws(format($q$select pin_set_credential(%L, '252634000009', '111111')$q$, old_u), 'credential already set', 'an existing account PIN cannot be overwritten');
end $$;

-- Reset requests: each has its own code; a newer request never replaces an older one.
do $$
declare
  u uuid; admin_id uuid; a record; b record; v record; n int; req_a uuid; req_b uuid;
begin
  u := pg_temp.new_user('252634000010', 'rider', '1234');
  admin_id := pg_temp.new_user('252634000099', 'admin');
  insert into auth.sessions (user_id) values (u);

  select * into a from pin_reset_request('252634000010', '111111', '10.1.0.1');
  perform pg_temp.eq(a.code ~ '^[0-9]{6}$', true, 'the requester gets a 6-digit code');
  perform pg_temp.eq(a.expires_at > now() + interval '119 minutes', true, 'codes last 2 hours');
  select * into b from pin_reset_request('252634000010', '222222', '10.1.0.2');
  select id into req_a from pin_reset_requests where user_id = u and crypt(a.code, code_hash) = code_hash;
  select id into req_b from pin_reset_requests where user_id = u and crypt(b.code, code_hash) = code_hash;
  select count(*) into n from pin_reset_requests where user_id = u and status = 'pending';
  perform pg_temp.eq(n, 2, 'both requests stay open');
  perform pg_temp.eq((select count(*)::int from pin_reset_requests where pin_hash like '%222222%' or code_hash like '%' || b.code || '%'), 0, 'PIN and code are stored only as hashes');

  perform pg_temp.act_as(admin_id);
  perform pg_temp.eq((select count(*)::int from admin_pin_reset_requests() where phone = '252634000010'), 2, 'admin sees both requests');
  perform pg_temp.eq((select max(open_for_number) from admin_pin_reset_requests() where phone = '252634000010'), 2, 'admin is told the number has 2 open requests');

  -- The code from request B does not approve request A.
  if a.code <> b.code then
    select * into v from admin_verify_pin_reset(req_a, b.code);
    perform pg_temp.eq(v.outcome, 'wrong_code', 'a code only works for its own request');
    perform pg_temp.eq(v.checks_left, 4, 'one wrong code used');
  end if;
  select * into v from admin_verify_pin_reset(req_b, b.code);
  perform pg_temp.eq(v.outcome, 'approved', 'the owner''s code approves their request');
  select * into v from admin_verify_pin_reset(req_b, b.code);
  perform pg_temp.eq(v.outcome, 'not_open', 'a code works only once');
  perform pg_temp.act_as_owner();

  perform pg_temp.eq((select status from pin_reset_requests where id = req_a), 'closed', 'the other open request is closed after approval');
  perform pg_temp.eq((select decided_by from pin_reset_requests where id = req_b), admin_id, 'who approved is recorded');
  perform pg_temp.eq((select count(*)::int from auth.sessions where user_id = u), 0, 'the account is signed out everywhere');
  perform pg_temp.eq((select outcome from pin_login('252634000010', '222222', '10.1.0.3')), 'ok', 'the new 6-digit PIN works');
  perform pg_temp.eq((select outcome from pin_login('252634000010', '1234', '10.1.0.3')), 'wrong', 'the old PIN no longer works');
end $$;

-- Wrong codes are limited; expired codes don't work; non-admins can't verify.
do $$
declare u uuid; admin_id uuid; c record; v record; req uuid; other uuid;
begin
  u := pg_temp.new_user('252634000011', 'customer');
  admin_id := pg_temp.new_user('252634000098', 'admin');
  select * into c from pin_reset_request('252634000011', '333333', '10.2.0.1');
  select id into req from pin_reset_requests where user_id = u;

  perform pg_temp.act_as(u);
  perform pg_temp.throws(format($q$select * from admin_verify_pin_reset(%L, %L)$q$, req, c.code), 'admins only', 'the requester cannot approve themselves');
  perform pg_temp.act_as_owner();

  perform pg_temp.act_as(admin_id);
  for i in 1..4 loop
    select * into v from admin_verify_pin_reset(req, case when c.code = '000000' then '000001' else '000000' end);
    perform pg_temp.eq(v.outcome, 'wrong_code', 'wrong codes 1-4');
  end loop;
  select * into v from admin_verify_pin_reset(req, 'abc');
  perform pg_temp.eq(v.outcome, 'failed', 'the 5th wrong code closes the request');
  select * into v from admin_verify_pin_reset(req, c.code);
  perform pg_temp.eq(v.outcome, 'not_open', 'the right code cannot reopen a failed request');
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select failed_checks from pin_reset_requests where id = req), 5, 'wrong codes were counted (not rolled back)');

  select * into c from pin_reset_request('252634000011', '444444', '10.2.0.2');
  select id into other from pin_reset_requests where user_id = u and status = 'pending';
  alter table pin_reset_requests disable trigger pin_reset_requests_guard;
  update pin_reset_requests set expires_at = now() - interval '1 minute' where id = other;
  alter table pin_reset_requests enable trigger pin_reset_requests_guard;
  perform pg_temp.act_as(admin_id);
  perform pg_temp.eq((select count(*)::int from admin_pin_reset_requests() where phone = '252634000011'), 0, 'expired requests are not listed');
  select * into v from admin_verify_pin_reset(other, c.code);
  perform pg_temp.eq(v.outcome, 'expired', 'an expired code does not work');
  perform pg_temp.act_as_owner();
end $$;

-- Requests are fixed once made, and limited per number and per address.
do $$
declare u uuid; c record; req uuid;
begin
  u := pg_temp.new_user('252634000012', 'customer');
  select * into c from pin_reset_request('252634000012', '555555', '10.3.0.1');
  select id into req from pin_reset_requests where user_id = u;
  perform pg_temp.throws(format($q$update pin_reset_requests set pin_hash = 'x' where id = %L$q$, req), 'cannot be changed', 'the new PIN cannot be swapped');
  perform pg_temp.throws(format($q$update pin_reset_requests set code_hash = 'x' where id = %L$q$, req), 'cannot be changed', 'the code cannot be swapped');
  perform pg_temp.throws(format($q$update pin_reset_requests set expires_at = now() + interval '9 days' where id = %L$q$, req), 'cannot be changed', 'the expiry cannot be extended');
  update pin_reset_requests set status = 'rejected', decided_at = now() where id = req;
  perform pg_temp.throws(format($q$update pin_reset_requests set status = 'approved' where id = %L$q$, req), 'already decided', 'a decision is final');

  perform pin_reset_request('252634000012', '555555', '10.3.0.2');
  perform pin_reset_request('252634000012', '555555', '10.3.0.3');
  perform pg_temp.throws($q$select * from pin_reset_request('252634000012', '555555', '10.3.0.4')$q$, 'Too many', '3 requests per number a day');
  perform pg_temp.throws($q$select * from pin_reset_request('252634000013', '1234', '10.3.0.5')$q$, 'invalid pin', 'reset PINs have 6 digits');

  for i in 1..10 loop perform pin_reset_request('25263400' || lpad((100 + i)::text, 4, '0'), '555555', '10.3.9.9'); end loop;
  perform pg_temp.throws($q$select * from pin_reset_request('252634009999', '555555', '10.3.9.9')$q$, 'Too many', '10 requests per address an hour');
end $$;

-- Unknown numbers get a code but nothing is stored; the old reset flow is retired.
do $$
declare c record;
begin
  select * into c from pin_reset_request('252631234567', '666666', '10.4.0.1');
  perform pg_temp.eq(c.code ~ '^[0-9]{6}$', true, 'unknown numbers still get a code');
  perform pg_temp.eq((select count(*)::int from pin_reset_requests where phone = '252631234567'), 0, 'nothing stored for unknown numbers');
  perform pg_temp.throws($q$select request_pin_reset('252634000001', 'jareeye-pin-1111')$q$, 'app update required', 'old reset requests are refused');
  perform pg_temp.throws($q$select review_pin_reset(gen_random_uuid(), true)$q$, 'app update required', 'old approvals are refused');
end $$;

-- Deleting an account removes its PIN and its wrong-PIN count.
do $$
declare u uuid;
begin
  u := pg_temp.new_user('252634000014', 'customer');
  perform pin_login('252634000014', '0000', '10.5.0.1');
  perform pg_temp.act_as(u);
  perform delete_my_account();
  perform pg_temp.act_as_owner();
  perform pg_temp.eq((select count(*)::int from pin_credentials where phone = '252634000014'), 0, 'credential deleted');
  perform pg_temp.eq((select count(*)::int from pin_login_guard where phone = '252634000014'), 0, 'wrong-PIN count deleted');
end $$;

-- Counts (including internet addresses) older than two days are deleted.
do $$
begin
  insert into auth_rate_limits (bucket, key, window_start, hits) values ('signin-fail-ip', '10.7.7.7', now() - interval '3 days', 3);
  perform consume_rate_limit('signup-ip', '10.7.7.8', 20, interval '1 hour');
  perform pg_temp.eq((select count(*)::int from auth_rate_limits where key = '10.7.7.7'), 0, 'old address records are deleted');
end $$;
