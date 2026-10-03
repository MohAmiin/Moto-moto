-- CUT-OVER STEP. Not a migration: run it by hand, once, only when docs/pin-security-rollout.md says so.
--
-- Until this runs, a phone-login account's Supabase Auth password is still "jareeye-pin-" + its PIN, so
-- old app versions can sign in and PINs can still be guessed directly against Supabase Auth.
-- This gives every phone-login account an unguessable random Supabase password. The PIN itself keeps
-- working through the pin-auth function (it is checked against pin_credentials, which already holds a
-- copy). Old app versions can no longer sign in after this; people must update the app.
begin;

-- Stop copying Supabase passwords into pin_credentials (the random ones must not replace real PINs).
drop trigger if exists copy_legacy_pin_credential on auth.users;

-- Refuse to run if any phone-login account has no PIN credential: it would be locked out.
do $$
declare missing int;
begin
  select count(*) into missing
  from auth.users u
  where u.email like '%@pin.jareeye.app'
    and not exists (select 1 from public.pin_credentials c where c.user_id = u.id);
  if missing > 0 then
    raise exception 'ABORTED: % phone-login accounts have no PIN credential', missing;
  end if;
end $$;

update auth.users
set encrypted_password = extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf', 10)),
    updated_at = now()
where email like '%@pin.jareeye.app';

commit;
