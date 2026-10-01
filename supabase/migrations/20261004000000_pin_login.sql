-- Phone + 4-digit PIN login, so drivers can sign in without SMS codes.
-- Each phone number gets an internal login address <digits>@pin.jareeye.app (unique per number); the app
-- turns the PIN into the password. A forgotten PIN is reset only after an admin approves the request.
-- Needs Authentication -> Providers -> Email enabled with "Confirm email" switched off.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- The verified phone number of a signed-in account: from SMS login, or from the PIN login address
-- ---------------------------------------------------------------------------
create or replace function public.account_phone(p_uid uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    nullif(u.phone, ''),
    case when u.email like '%@pin.jareeye.app' then split_part(u.email, '@', 1) end
  )
  from auth.users u where u.id = p_uid;
$$;
revoke execute on function public.account_phone(uuid) from public, anon, authenticated;

-- A profile's phone always matches the account's own number: customers call drivers on it, so drivers
-- must not be able to change it to someone else's. Admins and the SQL editor can still edit it.
create or replace function public.guard_profile_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'INSERT' then
      new.phone := coalesce(account_phone(new.id), new.phone);
    elsif new.phone is distinct from old.phone then
      new.phone := old.phone;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_phone on public.profiles;
create trigger profiles_guard_phone before insert or update on public.profiles
  for each row execute function public.guard_profile_phone();

-- ---------------------------------------------------------------------------
-- PIN reset requests, approved by an admin
-- ---------------------------------------------------------------------------
create table if not exists public.pin_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null,
  -- bcrypt hash of the new password; the PIN itself is never stored
  pin_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);
create index if not exists pin_resets_pending on public.pin_resets (created_at) where status = 'pending';

-- No policies: the table is only reached through the functions below.
alter table public.pin_resets enable row level security;

-- Anyone can ask for a reset (they're signed out, by definition). Nothing is revealed about whether the
-- number has an account; a newer request replaces an older pending one.
create or replace function public.request_pin_reset(p_phone text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid;
begin
  if p_phone !~ '^[0-9]{9,15}$' then raise exception 'invalid phone'; end if;
  if char_length(p_password) < 6 then raise exception 'invalid pin'; end if;
  select id into v_uid from auth.users where email = p_phone || '@pin.jareeye.app';
  if v_uid is null then return; end if;
  delete from pin_resets where user_id = v_uid and status = 'pending';
  insert into pin_resets (user_id, phone, pin_hash) values (v_uid, p_phone, crypt(p_password, gen_salt('bf')));
end;
$$;

-- Pending requests for the admin screen, with who the account belongs to.
create or replace function public.admin_pin_resets()
returns table (
  id uuid, phone text, created_at timestamptz,
  full_name text, role text, photo_path text, rider_number int
) language sql stable security definer set search_path = public as $$
  select r.id, r.phone, r.created_at, p.full_name, p.role::text, p.photo_path, a.rider_number
  from pin_resets r
  left join profiles p on p.id = r.user_id
  left join rider_applications a on a.user_id = r.user_id
  where r.status = 'pending' and is_admin()
  order by r.created_at;
$$;

-- Approving sets the new PIN and signs the account out everywhere; rejecting keeps the old PIN.
create or replace function public.review_pin_reset(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
declare r public.pin_resets;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select * into r from pin_resets where id = p_id and status = 'pending' for update;
  if not found then raise exception 'request not found'; end if;
  if p_approve then
    update auth.users set encrypted_password = r.pin_hash, updated_at = now() where id = r.user_id;
    delete from auth.sessions where user_id = r.user_id;
  end if;
  update pin_resets
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
end;
$$;

revoke execute on function public.request_pin_reset(text, text), public.admin_pin_resets(),
  public.review_pin_reset(uuid, boolean) from public;
grant execute on function public.request_pin_reset(text, text) to anon, authenticated;
grant execute on function public.admin_pin_resets(), public.review_pin_reset(uuid, boolean) to authenticated;
