-- The cut-over script keeps PINs working through pin_login and makes the Supabase password useless.
-- scripts/test-db.sh passes the script in as :rollout_lock, without its begin/commit.

do $$
begin
  perform pg_temp.new_user('252634400001', 'customer', '7788');
  perform pg_temp.new_user('252634400002', 'rider', '1122');
end $$;

\i :rollout_lock

do $$
begin
  perform pg_temp.eq((select outcome from pin_login('252634400001', '7788', '10.8.0.1')), 'ok', 'the PIN still works through pin-auth');
  perform pg_temp.eq(
    (select count(*)::int from auth.users where email like '%@pin.jareeye.app'
       and encrypted_password = crypt('jareeye-pin-7788', encrypted_password)),
    0, 'the old PIN no longer matches the Supabase password');
  perform pg_temp.eq(
    (select count(*)::int from pg_trigger where tgname = 'copy_legacy_pin_credential'),
    0, 'password copying is switched off');
end $$;
