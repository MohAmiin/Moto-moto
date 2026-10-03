-- PIN security: 6-digit PINs, limits on guessing, and PIN resets verified with a one-time code.
--
-- Until now the PIN was the Supabase password itself ("jareeye-pin-1234"), so anyone could try PINs
-- straight against Supabase Auth, limited only per internet connection. From now on:
--   * PINs are checked here, in pin_credentials, by the pin-auth Edge Function. Each number gets
--     5 tries, then a lock that doubles each time (15 min, 30 min, … up to 24 hours).
--   * New accounts and resets use 6 digits. Existing 4-digit PINs keep working (their current
--     Supabase password hash is copied below and checked the same way Supabase did).
--   * A PIN reset is one fixed request with its own 6-digit code, shown only to the person who asked.
--     The admin calls the account's number and types the code the owner reads out. Wrong codes are
--     limited, codes expire, a code works once, and a newer request never replaces an older one.
--
-- Rollout: this migration and the pin-auth function go live with the app update. Old app versions keep
-- signing in through Supabase Auth until supabase/rollout/lock-legacy-pin-passwords.sql is run,
-- which closes that path (see docs/pin-security-rollout.md). Safe to run more than once.

-- ---------------------------------------------------------------------------------------------------
-- Rate limits: fixed windows per (bucket, key), e.g. ('signin-ip', '196.x.x.x').
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.auth_rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, key)
);
alter table public.auth_rate_limits enable row level security;

/** Counts one hit; true while the count in the current window is within p_max. */
create or replace function public.consume_rate_limit(p_bucket text, p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into auth_rate_limits as r (bucket, key, window_start, hits)
  values (p_bucket, coalesce(p_key, 'unknown'), now(), 1)
  on conflict (bucket, key) do update set
    hits = case when r.window_start <= now() - p_window then 1 else r.hits + 1 end,
    window_start = case when r.window_start <= now() - p_window then now() else r.window_start end
  returning hits into v_hits;
  -- Counts older than two days are deleted (the privacy policy promises this for internet addresses).
  delete from auth_rate_limits where window_start < now() - interval '2 days';
  return v_hits <= p_max;
end;
$$;

/** Hits in the current window, without counting one. */
create or replace function public.rate_limit_hits(p_bucket text, p_key text, p_window interval)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select hits from auth_rate_limits
    where bucket = p_bucket and key = coalesce(p_key, 'unknown') and window_start > now() - p_window
  ), 0);
$$;

-- ---------------------------------------------------------------------------------------------------
-- PIN credentials: one per phone-login account
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.pin_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique check (phone ~ '^[0-9]{9,15}$'),
  -- bcrypt. 'legacy4' hashes "jareeye-pin-" + 4 digits (the old Supabase password); 'pin6' hashes 6 digits.
  pin_hash text not null,
  scheme text not null check (scheme in ('legacy4', 'pin6')),
  updated_at timestamptz not null default now()
);
alter table public.pin_credentials enable row level security;

-- Wrong-PIN counts per number, also for numbers without an account, so guessing reveals nothing.
create table if not exists public.pin_login_guard (
  phone text primary key,
  failed_attempts int not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz
);
alter table public.pin_login_guard enable row level security;

-- Existing accounts keep their PIN: copy the current Supabase password hash.
insert into public.pin_credentials (user_id, phone, pin_hash, scheme)
select u.id, split_part(u.email, '@', 1), u.encrypted_password, 'legacy4'
from auth.users u
where u.email like '%@pin.jareeye.app'
  and split_part(u.email, '@', 1) ~ '^[0-9]{9,15}$'
  and u.encrypted_password like '$2%'
on conflict (user_id) do nothing;

-- Accounts that old app versions create before the cut-over get a credential the same way.
-- (New accounts from pin-auth are created with a random password; pin_set_credential then replaces it.)
create or replace function public.copy_legacy_pin_credential()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.email like '%@pin.jareeye.app'
     and split_part(new.email, '@', 1) ~ '^[0-9]{9,15}$'
     and new.encrypted_password like '$2%' then
    insert into pin_credentials (user_id, phone, pin_hash, scheme)
    values (new.id, split_part(new.email, '@', 1), new.encrypted_password, 'legacy4')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists copy_legacy_pin_credential on auth.users;
create trigger copy_legacy_pin_credential after insert on auth.users
  for each row execute function public.copy_legacy_pin_credential();

/** 5 free tries, then 15 minutes, doubling with each further wrong PIN, at most 24 hours. */
create or replace function public.pin_lock_seconds(p_failures int)
returns int language sql immutable as $$
  select case when p_failures < 5 then 0 else least(86400, 900 * power(2, p_failures - 5))::int end;
$$;

-- Sign-in limits per internet address (mobile networks share addresses, so these are generous).
-- The per-number lock above is the main protection.
create or replace function public.pin_ip_failure_limit() returns int language sql immutable as $$ select 50 $$;

/**
 * Checks a phone + PIN for the pin-auth function. Outcomes:
 *   ok (with user_id), wrong, locked (with retry_after_seconds), ip_limited, invalid.
 * A wrong PIN and an unknown number look the same.
 */
create or replace function public.pin_login(p_phone text, p_pin text, p_ip text default null)
returns table (outcome text, user_id uuid, retry_after_seconds int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  g pin_login_guard;
  c pin_credentials;
  v_ok boolean := false;
begin
  if p_phone !~ '^[0-9]{9,15}$' or p_pin !~ '^([0-9]{4}|[0-9]{6})$' then
    return query select 'invalid', null::uuid, null::int;
    return;
  end if;
  if rate_limit_hits('signin-fail-ip', p_ip, interval '1 hour') >= pin_ip_failure_limit() then
    return query select 'ip_limited', null::uuid, 3600;
    return;
  end if;

  -- Lock this number's row so parallel guesses are counted one after another.
  insert into pin_login_guard (phone) values (p_phone) on conflict (phone) do nothing;
  select * into g from pin_login_guard where phone = p_phone for update;
  -- A day without wrong PINs starts the count again.
  if g.last_failed_at < now() - interval '24 hours' and (g.locked_until is null or g.locked_until <= now()) then
    update pin_login_guard set failed_attempts = 0, locked_until = null where phone = p_phone returning * into g;
  end if;
  if g.locked_until > now() then
    return query select 'locked', null::uuid, ceil(extract(epoch from g.locked_until - now()))::int;
    return;
  end if;

  select * into c from pin_credentials where phone = p_phone;
  if found then
    v_ok := case c.scheme
      when 'pin6' then p_pin ~ '^[0-9]{6}$' and crypt(p_pin, c.pin_hash) = c.pin_hash
      when 'legacy4' then p_pin ~ '^[0-9]{4}$' and crypt('jareeye-pin-' || p_pin, c.pin_hash) = c.pin_hash
    end;
  end if;

  if v_ok then
    update pin_login_guard set failed_attempts = 0, last_failed_at = null, locked_until = null where phone = p_phone;
    return query select 'ok', c.user_id, null::int;
    return;
  end if;

  perform consume_rate_limit('signin-fail-ip', p_ip, pin_ip_failure_limit(), interval '1 hour');
  update pin_login_guard
  set failed_attempts = failed_attempts + 1,
      last_failed_at = now(),
      locked_until = case when pin_lock_seconds(failed_attempts + 1) > 0
                          then now() + make_interval(secs => pin_lock_seconds(failed_attempts + 1)) end
  where phone = p_phone
  returning * into g;
  if g.locked_until > now() then
    return query select 'locked', null::uuid, ceil(extract(epoch from g.locked_until - now()))::int;
  else
    return query select 'wrong', null::uuid, null::int;
  end if;
end;
$$;

/**
 * Saves a new 6-digit PIN for an account the pin-auth function just created. Only for accounts whose
 * login address matches the number, and only once: an existing credential is never overwritten here.
 */
create or replace function public.pin_set_credential(p_user_id uuid, p_phone text, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if p_pin !~ '^[0-9]{6}$' then raise exception 'invalid pin'; end if;
  if not exists (select 1 from auth.users where id = p_user_id and email = p_phone || '@pin.jareeye.app') then
    raise exception 'account does not match phone';
  end if;
  -- The copy trigger may have stored the random creation password; replace only that.
  insert into pin_credentials (user_id, phone, pin_hash, scheme)
  values (p_user_id, p_phone, crypt(p_pin, gen_salt('bf', 10)), 'pin6')
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, scheme = 'pin6', updated_at = now()
    where pin_credentials.scheme = 'legacy4'
      and pin_credentials.updated_at > now() - interval '5 minutes'
      and exists (select 1 from auth.users u where u.id = p_user_id and u.created_at > now() - interval '5 minutes');
  if not found then raise exception 'credential already set'; end if;
end;
$$;

/** True when the sign-up attempt from this address is allowed (at most 20 an hour). */
create or replace function public.pin_signup_allowed(p_ip text)
returns boolean language sql security definer set search_path = public as $$
  select consume_rate_limit('signup-ip', p_ip, 20, interval '1 hour');
$$;

-- ---------------------------------------------------------------------------------------------------
-- PIN reset requests
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.pin_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null,
  -- bcrypt of the new 6-digit PIN and of the code shown to the requester; neither is stored in plain text.
  pin_hash text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired', 'failed', 'closed')),
  failed_checks int not null default 0 check (failed_checks between 0 and 5),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz
);
create index if not exists pin_reset_requests_open on public.pin_reset_requests (user_id) where status = 'pending';
-- No policies: only the functions below read or change requests.
alter table public.pin_reset_requests enable row level security;

-- A request never changes what it asks for, and once decided it stays decided.
create or replace function public.guard_pin_reset_request()
returns trigger language plpgsql as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.phone is distinct from old.phone
     or new.pin_hash is distinct from old.pin_hash or new.code_hash is distinct from old.code_hash
     or new.created_at is distinct from old.created_at or new.expires_at is distinct from old.expires_at then
    raise exception 'pin reset requests cannot be changed';
  end if;
  if old.status <> 'pending' and (new.status is distinct from old.status or new.failed_checks is distinct from old.failed_checks
     or new.decided_at is distinct from old.decided_at
     or (new.decided_by is distinct from old.decided_by and new.decided_by is not null)) then
    raise exception 'pin reset request is already decided';
  end if;
  return new;
end;
$$;
drop trigger if exists pin_reset_requests_guard on public.pin_reset_requests;
create trigger pin_reset_requests_guard before update on public.pin_reset_requests
  for each row execute function public.guard_pin_reset_request();

/** How long a reset code stays valid, and how many wrong codes the admin may enter. */
create or replace function public.pin_reset_ttl() returns interval language sql immutable as $$ select interval '2 hours' $$;
create or replace function public.pin_reset_max_checks() returns int language sql immutable as $$ select 5 $$;

/** A random 6-digit code. */
create or replace function public.random_six_digits()
returns text language sql volatile set search_path = public, extensions as $$
  select lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
$$;

/**
 * Creates a reset request for the pin-auth function and returns the code for the requester's screen.
 * Each request stands alone: earlier open requests stay as they are, so the admin sees all of them.
 * Limits: 3 requests per number a day, 10 per internet address an hour. Unknown numbers get a code that
 * matches nothing, so the answer never reveals whether a number has an account.
 */
create or replace function public.pin_reset_request(p_phone text, p_pin text, p_ip text default null)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_uid uuid;
  v_code text := random_six_digits();
  v_expires timestamptz := now() + pin_reset_ttl();
begin
  if p_phone !~ '^[0-9]{9,15}$' then raise exception 'invalid phone'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'invalid pin'; end if;
  if not consume_rate_limit('reset-ip', p_ip, 10, interval '1 hour')
     or not consume_rate_limit('reset-phone', p_phone, 3, interval '24 hours') then
    raise exception 'Too many reset requests';
  end if;

  select id into v_uid from auth.users where email = p_phone || '@pin.jareeye.app';
  if v_uid is not null then
    insert into pin_reset_requests (user_id, phone, pin_hash, code_hash, expires_at)
    values (v_uid, p_phone, crypt(p_pin, gen_salt('bf', 10)), crypt(v_code, gen_salt('bf', 10)), v_expires);
  end if;
  return query select v_code, v_expires;
end;
$$;

/** Open reset requests for the admin screen, oldest first, with who the account belongs to. */
create or replace function public.admin_pin_reset_requests()
returns table (
  id uuid, phone text, created_at timestamptz, expires_at timestamptz, checks_left int,
  open_for_number int, full_name text, role text, photo_path text, rider_number int
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select r.id, r.phone, r.created_at, r.expires_at, pin_reset_max_checks() - r.failed_checks,
           (count(*) over (partition by r.user_id))::int,
           p.full_name, p.role::text, p.photo_path, a.rider_number
    from pin_reset_requests r
    left join profiles p on p.id = r.user_id
    left join rider_applications a on a.user_id = r.user_id
    where r.status = 'pending' and r.expires_at > now()
    order by r.created_at;
end;
$$;

/**
 * The admin types the code the account owner read out on the phone. Returns:
 *   approved, wrong_code (with checks_left), failed (too many wrong codes), expired, not_open.
 * Only this request is approved; the owner's other open requests are closed afterwards.
 * Returns instead of raising so a wrong code is still counted.
 */
create or replace function public.admin_verify_pin_reset(p_id uuid, p_code text)
returns table (outcome text, checks_left int)
language plpgsql security definer set search_path = public, extensions, auth as $$
declare r pin_reset_requests;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select * into r from pin_reset_requests where id = p_id for update;
  if not found or r.status <> 'pending' then
    return query select 'not_open', 0;
    return;
  end if;
  if r.expires_at <= now() then
    update pin_reset_requests set status = 'expired', decided_at = now() where id = p_id;
    return query select 'expired', 0;
    return;
  end if;

  if coalesce(p_code, '') !~ '^[0-9]{6}$' or crypt(p_code, r.code_hash) <> r.code_hash then
    if r.failed_checks + 1 >= pin_reset_max_checks() then
      update pin_reset_requests
      set failed_checks = r.failed_checks + 1, status = 'failed', decided_by = auth.uid(), decided_at = now()
      where id = p_id;
      return query select 'failed', 0;
    else
      update pin_reset_requests set failed_checks = r.failed_checks + 1 where id = p_id;
      return query select 'wrong_code', pin_reset_max_checks() - r.failed_checks - 1;
    end if;
    return;
  end if;

  insert into pin_credentials (user_id, phone, pin_hash, scheme)
  values (r.user_id, r.phone, r.pin_hash, 'pin6')
  on conflict (user_id) do update set pin_hash = excluded.pin_hash, scheme = 'pin6', updated_at = now();
  -- Unlock the number and sign the account out everywhere.
  delete from pin_login_guard where phone = r.phone;
  delete from auth.sessions where user_id = r.user_id;

  update pin_reset_requests set status = 'approved', decided_by = auth.uid(), decided_at = now() where id = p_id;
  update pin_reset_requests set status = 'closed', decided_by = auth.uid(), decided_at = now()
  where user_id = r.user_id and status = 'pending' and id <> p_id;
  return query select 'approved', 0;
end;
$$;

create or replace function public.admin_reject_pin_reset(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update pin_reset_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now()
  where id = p_id and status = 'pending';
  if not found then raise exception 'request not found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Retire the old reset flow: its requests had no code, so none of them can be safely approved.
-- ---------------------------------------------------------------------------------------------------
update public.pin_resets set status = 'rejected', reviewed_at = now() where status = 'pending';

create or replace function public.request_pin_reset(p_phone text, p_password text)
returns void language plpgsql as $$
begin
  raise exception 'app update required';
end;
$$;

create or replace function public.review_pin_reset(p_id uuid, p_approve boolean)
returns void language plpgsql as $$
begin
  raise exception 'app update required';
end;
$$;

create or replace function public.admin_pin_resets()
returns table (id uuid, phone text, created_at timestamptz, full_name text, role text, photo_path text, rider_number int)
language sql stable as $$
  select null::uuid, null::text, null::timestamptz, null::text, null::text, null::text, null::int where false;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Delete my account: also forget the number's wrong-PIN count
-- ---------------------------------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  -- Keep at least the owner in charge: admins are removed from the SQL editor instead.
  if is_admin() then raise exception 'admins cannot delete their own account in the app'; end if;
  v_phone := account_phone(v_uid);

  -- Links that would otherwise block the delete (orders are from the earlier marketplace version).
  update rider_applications set reviewed_by = null where reviewed_by = v_uid;
  update pin_resets set reviewed_by = null where reviewed_by = v_uid;
  update orders set rider_id = null where rider_id = v_uid;
  delete from orders where customer_id = v_uid;
  if v_phone is not null then delete from pin_login_guard where phone = v_phone; end if;

  -- Cascades to profiles, rider_applications, calls, pin_credentials and reset requests.
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------------
revoke execute on function
  public.consume_rate_limit(text, text, int, interval),
  public.rate_limit_hits(text, text, interval),
  public.copy_legacy_pin_credential(),
  public.pin_login(text, text, text),
  public.pin_set_credential(uuid, text, text),
  public.pin_signup_allowed(text),
  public.pin_reset_request(text, text, text),
  public.random_six_digits(),
  public.admin_pin_reset_requests(),
  public.admin_verify_pin_reset(uuid, text),
  public.admin_reject_pin_reset(uuid),
  public.request_pin_reset(text, text),
  public.review_pin_reset(uuid, boolean),
  public.admin_pin_resets(),
  public.delete_my_account()
from public, anon, authenticated;

-- The tables are reached only through the functions above; app users get no direct access at all.
revoke all on table public.auth_rate_limits, public.pin_credentials, public.pin_login_guard, public.pin_reset_requests
from anon, authenticated;

-- Only the pin-auth Edge Function (secret key) signs in, signs up and requests resets.
grant execute on function
  public.pin_login(text, text, text),
  public.pin_set_credential(uuid, text, text),
  public.pin_signup_allowed(text),
  public.pin_reset_request(text, text, text)
to service_role;

grant execute on function
  public.admin_pin_reset_requests(),
  public.admin_verify_pin_reset(uuid, text),
  public.admin_reject_pin_reset(uuid),
  public.delete_my_account(),
  -- Old app versions get a clear "update the app" error instead of "function not found".
  public.request_pin_reset(text, text),
  public.review_pin_reset(uuid, boolean),
  public.admin_pin_resets()
to authenticated;
grant execute on function public.request_pin_reset(text, text) to anon;
