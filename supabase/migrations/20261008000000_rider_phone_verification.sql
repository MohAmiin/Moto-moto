-- Riders are approved only after an admin has called their registered number and confirmed it.
--
-- The rider opens their pending screen and taps "Get code"; the admin calls the number on the
-- application and types the code the rider reads out. That proves the person answering that number is
-- the person holding the account. The admin who confirmed it and when are recorded on the application,
-- and review_rider refuses approval without a confirmation for the rider's current number.
-- Riders approved before this migration keep their approval. Safe to run more than once.

alter table public.rider_applications add column if not exists phone_verified_by uuid references public.profiles (id) on delete set null;
alter table public.rider_applications add column if not exists phone_verified_at timestamptz;
-- The number that was confirmed; if an admin later changes the profile's number, approval needs a new check.
alter table public.rider_applications add column if not exists phone_verified_number text;

-- The rider's current code (one at a time, their own); only reachable through the functions below.
create table if not exists public.rider_phone_checks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  failed_checks int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.rider_phone_checks enable row level security;

-- Riders can't fill in review or verification fields themselves. Resubmitting after a rejection clears
-- the old review, which also fixes resubmission: the policy needs reviewed_by to be empty, and the app
-- doesn't send it.
create or replace function public.guard_rider_application_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.reviewed_by is not null or new.reviewed_at is not null or new.phone_verified_by is not null
       or new.phone_verified_at is not null or new.phone_verified_number is not null then
      raise exception 'review fields are set by admins';
    end if;
    return new;
  end if;
  if old.status = 'rejected' and new.status = 'pending' then
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'review fields are set by admins';
  end if;
  if new.phone_verified_by is distinct from old.phone_verified_by or new.phone_verified_at is distinct from old.phone_verified_at
     or new.phone_verified_number is distinct from old.phone_verified_number then
    raise exception 'review fields are set by admins';
  end if;
  return new;
end;
$$;
drop trigger if exists rider_applications_guard_review on public.rider_applications;
create trigger rider_applications_guard_review before insert or update on public.rider_applications
  for each row execute function public.guard_rider_application_review();

/**
 * A fresh 6-digit code for the signed-in rider to read out when the admin calls. Valid 30 minutes;
 * asking again replaces the rider's previous code. At most 10 codes an hour.
 */
create or replace function public.rider_phone_code()
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_code text := random_six_digits();
  v_expires timestamptz := now() + interval '30 minutes';
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from rider_applications where user_id = v_uid) then
    raise exception 'application not found';
  end if;
  if not consume_rate_limit('rider-code', v_uid::text, 10, interval '1 hour') then
    raise exception 'Too many codes';
  end if;
  insert into rider_phone_checks as c (user_id, code_hash, expires_at)
  values (v_uid, crypt(v_code, gen_salt('bf', 10)), v_expires)
  on conflict (user_id) do update
    set code_hash = excluded.code_hash, expires_at = excluded.expires_at, failed_checks = 0, created_at = now();
  return query select v_code, v_expires;
end;
$$;

/**
 * The admin, on a call to the rider's registered number, types the code the rider reads out. Returns:
 *   confirmed, wrong_code (with checks_left), failed (5 wrong codes; the rider must get a new code),
 *   expired, no_code. Returns instead of raising so a wrong code is still counted.
 */
create or replace function public.admin_confirm_rider_phone(p_user_id uuid, p_code text)
returns table (outcome text, checks_left int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  c rider_phone_checks;
  v_phone text;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  select * into c from rider_phone_checks where user_id = p_user_id for update;
  if not found then
    return query select 'no_code', 0;
    return;
  end if;
  if c.failed_checks >= 5 then
    return query select 'failed', 0;
    return;
  end if;
  if c.expires_at <= now() then
    return query select 'expired', 0;
    return;
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$' or crypt(p_code, c.code_hash) <> c.code_hash then
    update rider_phone_checks set failed_checks = failed_checks + 1 where user_id = p_user_id;
    return query select case when c.failed_checks + 1 >= 5 then 'failed' else 'wrong_code' end, greatest(0, 4 - c.failed_checks);
    return;
  end if;

  select phone into v_phone from profiles where id = p_user_id;
  if v_phone is null then raise exception 'rider has no phone number'; end if;
  update rider_applications
  set phone_verified_by = auth.uid(), phone_verified_at = now(), phone_verified_number = v_phone
  where user_id = p_user_id;
  if not found then raise exception 'application not found'; end if;
  -- The code is used up.
  delete from rider_phone_checks where user_id = p_user_id;
  return query select 'confirmed', 0;
end;
$$;

-- Approval needs a confirmed call to the rider's current number. Rejecting doesn't.
create or replace function public.review_rider(p_user_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  if p_approve and not exists (
    select 1 from rider_applications a join profiles p on p.id = a.user_id
    where a.user_id = p_user_id and a.phone_verified_at is not null
      and p.phone is not null and a.phone_verified_number = p.phone
  ) then
    raise exception 'phone not verified';
  end if;
  update rider_applications
  set status = case when p_approve then 'approved'::application_status else 'rejected'::application_status end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      rider_number = case when p_approve then coalesce(rider_number, nextval('rider_number_seq')::int) else rider_number end
  where user_id = p_user_id;
  if not found then raise exception 'application not found'; end if;
end;
$$;

revoke all on table public.rider_phone_checks from anon, authenticated;

revoke execute on function
  public.guard_rider_application_review(),
  public.rider_phone_code(),
  public.admin_confirm_rider_phone(uuid, text),
  public.review_rider(uuid, boolean)
from public, anon, authenticated;
grant execute on function
  public.rider_phone_code(),
  public.admin_confirm_rider_phone(uuid, text),
  public.review_rider(uuid, boolean)
to authenticated;
