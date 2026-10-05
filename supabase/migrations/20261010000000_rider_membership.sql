-- Rider memberships. An admin switch, OFF by default: while it is off nothing changes for riders. While it
-- is on, an approved rider can go online and be found by customers only while their membership is paid up.
--
-- Payments are taken outside the app. An admin checks the money arrived in their own account, then records
-- it (amount in USD, payment method, and the transaction reference unless it was cash) and it adds 30 days: from the current expiry when renewing early, from now when expired or new. The first
-- time the switch is turned on, riders already approved get 30 days' grace, once; turning it off and on
-- again grants nothing more. Everything uses the database clock, so it holds while the app is closed.

-- ---------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.membership_settings (
  id boolean primary key default true check (id),
  required boolean not null default false,
  -- Price per 30 days shown to riders. Needed before the switch can be turned on.
  price_usd numeric(10, 2) check (price_usd is null or price_usd > 0),
  -- How to pay and whom to contact, shown to riders whose membership is ending or has ended.
  instructions text check (instructions is null or length(instructions) <= 1000),
  -- When the switch was first turned on (and grace given). Never cleared.
  first_enabled_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
-- The pilot's intended price is $1 per 30 days. The switch stays off: the pilot is free.
insert into public.membership_settings (price_usd) values (1.00) on conflict (id) do nothing;

create table if not exists public.rider_memberships (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Every confirmed payment and every grace period: who, when, how much, and the dates that resulted.
-- Kept when the switch is off. When a rider deletes their account the rows stay, without the link to them.
create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('payment', 'grace')),
  amount_usd numeric(10, 2) not null check (amount_usd >= 0 and (kind = 'grace' or amount_usd > 0)),
  -- How the money arrived. Required for payments; cash needs no reference.
  method text check (method in ('cash', 'zaad', 'edahab', 'evc_plus', 'sahal', 'bank', 'other')),
  -- Transaction reference as typed, and the same with only letters and digits, upper case, for matching.
  reference text check (reference is null or length(reference) <= 120),
  reference_key text generated always as (nullif(upper(regexp_replace(coalesce(reference, ''), '[^A-Za-z0-9]', '', 'g')), '')) stored,
  -- The admin's receiving account (number or bank account). Required for bank and other, where a
  -- reference is only unique within one account.
  received_into text check (received_into is null or length(received_into) <= 60),
  received_key text generated always as (nullif(upper(regexp_replace(coalesce(received_into, ''), '[^A-Za-z0-9]', '', 'g')), '')) stored,
  -- Sent by the admin's screen with each confirmation, so a retry or double tap can't renew twice.
  request_id uuid unique,
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  previous_expires_at timestamptz,
  period_start timestamptz not null,
  period_end timestamptz not null,
  constraint payment_has_method check (kind = 'grace' or method is not null),
  constraint non_cash_has_reference check (kind = 'grace' or method = 'cash' or reference_key is not null),
  constraint bank_has_account check (kind = 'grace' or method not in ('bank', 'other') or received_key is not null)
);
create index if not exists membership_payments_user on public.membership_payments (user_id, confirmed_at desc);
-- A transaction reference can be credited once: per provider for mobile money (their IDs are unique per
-- provider), per receiving account for bank and other.
create unique index if not exists membership_payments_reference on public.membership_payments (
  method, (case when method in ('bank', 'other') then received_key else '' end), reference_key
) where reference_key is not null;

alter table public.membership_settings enable row level security;
alter table public.rider_memberships enable row level security;
alter table public.membership_payments enable row level security;

-- Admins read everything; a rider reads only their own expiry; customers read nothing. All writes go
-- through the functions below.
drop policy if exists "admins read membership settings" on public.membership_settings;
create policy "admins read membership settings" on public.membership_settings for select to authenticated using (public.is_admin());
drop policy if exists "own or admin membership" on public.rider_memberships;
create policy "own or admin membership" on public.rider_memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admins read membership payments" on public.membership_payments;
create policy "admins read membership payments" on public.membership_payments for select to authenticated using (public.is_admin());

revoke insert, update, delete, truncate on public.membership_settings, public.rider_memberships, public.membership_payments
  from anon, authenticated;
revoke all on public.membership_settings, public.rider_memberships, public.membership_payments from anon;

-- ---------------------------------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------------------------------

-- True when the rider may be online: the switch is off, or their membership runs past now.
create or replace function public.membership_ok(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce((select required from membership_settings), false)
      or exists (select 1 from rider_memberships m where m.user_id = p_user_id and m.expires_at > now());
$$;

-- free (switch off), active, expiring (3 days or less left), expired, or unpaid (never paid).
create or replace function public.membership_status_of(p_user_id uuid)
returns table (status text, expires_at timestamptz, days_left int)
language sql stable security definer set search_path = public as $$
  select
    case
      when not coalesce((select required from membership_settings), false) then 'free'
      when m.expires_at is null then 'unpaid'
      when m.expires_at <= now() then 'expired'
      when m.expires_at <= now() + interval '3 days' then 'expiring'
      else 'active'
    end,
    m.expires_at,
    case when m.expires_at is null then null
         else greatest(0, ceil(extract(epoch from (m.expires_at - now())) / 86400))::int end
  from (select 1) one
  left join rider_memberships m on m.user_id = p_user_id;
$$;

-- The signed-in rider's membership, with the price and payment instructions to show them.
create or replace function public.my_membership()
returns table (status text, expires_at timestamptz, days_left int, price_usd numeric, instructions text)
language sql stable security definer set search_path = public as $$
  select st.status, st.expires_at, st.days_left, s.price_usd, s.instructions
  from membership_status_of(auth.uid()) st cross join membership_settings s
  where auth.uid() is not null;
$$;

-- Every rider's membership, for the admin screens.
create or replace function public.admin_rider_memberships()
returns table (user_id uuid, status text, expires_at timestamptz, days_left int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select a.user_id, st.status, st.expires_at, st.days_left
    from rider_applications a cross join lateral membership_status_of(a.user_id) st;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------------------------------

-- Saves the switch, price and instructions. Turning the switch on needs a price. The first time it is
-- turned on, riders approved by then get 30 days' grace (recorded as 'grace'); later times give nothing.
create or replace function public.admin_set_membership_settings(p_required boolean, p_price_usd numeric, p_instructions text)
returns table (is_required boolean, grace_given int)
language plpgsql security definer set search_path = public as $$
declare
  s membership_settings;
  v_given int := 0;
  v_until timestamptz := now() + interval '30 days';
begin
  if not is_admin() then raise exception 'admins only'; end if;
  if p_price_usd is not null and (p_price_usd <= 0 or p_price_usd > 10000) then raise exception 'invalid price'; end if;
  if p_required and p_price_usd is null then raise exception 'price required'; end if;

  select * into s from membership_settings for update;

  if p_required and s.first_enabled_at is null then
    -- Grace for riders approved now: 30 days from now, unless they already have longer.
    with granted as (
      insert into rider_memberships as m (user_id, expires_at)
      select a.user_id, v_until
      from rider_applications a join profiles p on p.id = a.user_id
      where a.status = 'approved' and p.role = 'rider'
      on conflict (user_id) do update set expires_at = excluded.expires_at, updated_at = now()
        where m.expires_at < excluded.expires_at
      returning m.user_id
    ), logged as (
      insert into membership_payments (user_id, kind, amount_usd, confirmed_by, previous_expires_at, period_start, period_end)
      select g.user_id, 'grace', 0, auth.uid(), null, now(), v_until from granted g
      returning 1
    )
    select count(*) into v_given from logged;
    update membership_settings set first_enabled_at = now() where id;
  end if;

  update membership_settings
  set required = p_required,
      price_usd = p_price_usd,
      instructions = nullif(btrim(coalesce(p_instructions, '')), ''),
      updated_by = auth.uid(),
      updated_at = now()
  where id;

  return query select p_required, v_given;
end;
$$;

-- Records a payment taken outside the app and adds 30 days. `p_request_id` comes from the admin's screen:
-- sending the same one again returns the first result and changes nothing. A transaction reference can
-- be credited only once (see membership_payments_reference), to any rider. Cash has no reference, so a
-- second cash payment for the same rider and amount within 2 minutes is refused as a likely double tap.
-- Does not put the rider online.
create or replace function public.admin_confirm_membership_payment(
  p_user_id uuid, p_amount_usd numeric, p_method text, p_reference text, p_received_into text, p_request_id uuid
) returns table (payment_id uuid, period_start timestamptz, period_end timestamptz, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare
  pay membership_payments;
  v_prev timestamptz;
  v_start timestamptz;
  v_ref text := nullif(btrim(coalesce(p_reference, '')), '');
  v_ref_key text := nullif(upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g')), '');
  v_into text := nullif(btrim(coalesce(p_received_into, '')), '');
  v_into_key text := nullif(upper(regexp_replace(coalesce(p_received_into, ''), '[^A-Za-z0-9]', '', 'g')), '');
begin
  if not is_admin() then raise exception 'admins only'; end if;
  if p_request_id is null then raise exception 'request id required'; end if;

  -- One confirmation at a time per rider.
  perform pg_advisory_xact_lock(hashtextextended('membership:' || p_user_id::text, 0));

  -- A retry of a confirmation that went through: the original result, nothing more.
  select * into pay from membership_payments where request_id = p_request_id;
  if found then
    if pay.user_id is distinct from p_user_id then raise exception 'request id already used'; end if;
    return query select pay.id, pay.period_start, pay.period_end, true;
    return;
  end if;

  if p_amount_usd is null or p_amount_usd <= 0 or p_amount_usd > 10000 then raise exception 'invalid amount'; end if;
  if p_method is null or p_method not in ('cash', 'zaad', 'edahab', 'evc_plus', 'sahal', 'bank', 'other') then raise exception 'invalid method'; end if;
  if p_method <> 'cash' and v_ref_key is null then raise exception 'reference required'; end if;
  if p_method in ('bank', 'other') and v_into_key is null then raise exception 'receiving account required'; end if;
  if v_ref is not null and length(v_ref) > 120 then raise exception 'reference too long'; end if;
  if v_into is not null and length(v_into) > 60 then raise exception 'receiving account too long'; end if;
  if not exists (select 1 from rider_applications a join profiles p on p.id = a.user_id where a.user_id = p_user_id and p.role = 'rider') then
    raise exception 'not a rider';
  end if;

  if v_ref_key is not null then
    -- Two confirmations with the same reference (for any riders) wait for each other.
    perform pg_advisory_xact_lock(hashtextextended('membership-ref:' || p_method || ':' || v_ref_key, 0));
    if exists (
      select 1 from membership_payments mp
      where mp.method = p_method and mp.reference_key = v_ref_key
        and (p_method not in ('bank', 'other') or mp.received_key = v_into_key)
    ) then
      raise exception 'reference already used';
    end if;
  elsif exists (
    select 1 from membership_payments mp
    where mp.user_id = p_user_id and mp.kind = 'payment' and mp.amount_usd = p_amount_usd
      and mp.reference_key is null and mp.confirmed_at > now() - interval '2 minutes'
  ) then
    raise exception 'possible duplicate';
  end if;

  select m.expires_at into v_prev from rider_memberships m where m.user_id = p_user_id for update;
  v_start := greatest(now(), coalesce(v_prev, now()));

  insert into rider_memberships as m (user_id, expires_at) values (p_user_id, v_start + interval '30 days')
  on conflict (user_id) do update set expires_at = excluded.expires_at, updated_at = now();

  begin
    insert into membership_payments (user_id, kind, amount_usd, method, reference, received_into, request_id, confirmed_by, previous_expires_at, period_start, period_end)
    values (p_user_id, 'payment', p_amount_usd, p_method, v_ref, v_into, p_request_id, auth.uid(), v_prev, v_start, v_start + interval '30 days')
    returning * into pay;
  exception when unique_violation then
    -- The unique index is the last word, even against a race the locks above missed.
    raise exception 'reference already used';
  end;

  return query select pay.id, pay.period_start, pay.period_end, false;
end;
$$;

-- A rider's payments and grace periods, newest first, with who confirmed them.
create or replace function public.admin_membership_history(p_user_id uuid)
returns table (
  id uuid, kind text, amount_usd numeric, method text, reference text, received_into text, confirmed_at timestamptz,
  confirmed_by_name text, previous_expires_at timestamptz, period_start timestamptz, period_end timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select mp.id, mp.kind, mp.amount_usd, mp.method, mp.reference, mp.received_into, mp.confirmed_at, p.full_name,
           mp.previous_expires_at, mp.period_start, mp.period_end
    from membership_payments mp left join profiles p on p.id = mp.confirmed_by
    where mp.user_id = p_user_id
    order by mp.confirmed_at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Enforcement
-- ---------------------------------------------------------------------------------------------------

-- Going online needs a valid membership while the switch is on. Staying online (the 30-second updates)
-- isn't blocked here; an expired rider simply stops appearing in nearby_riders below.
create or replace function public.guard_rider_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_online and not coalesce(old.is_online, false) and new.role = 'rider' and not membership_ok(new.id) then
    raise exception 'membership required';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_membership on public.profiles;
create trigger profiles_guard_membership before update of is_online on public.profiles
  for each row execute function public.guard_rider_membership();

-- nearby_riders as in 20261009000000_one_rating_per_customer.sql, plus the membership check.
create or replace function public.nearby_riders(
  p_lat double precision default null,
  p_lng double precision default null,
  p_area text default null
) returns table (
  id uuid,
  full_name text,
  phone text,
  plate text,
  area text,
  lat double precision,
  lng double precision,
  distance_km double precision,
  last_seen_at timestamptz,
  photo_path text,
  rider_number int,
  rating numeric,
  rating_count int,
  is_busy boolean
) language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.full_name,
    p.phone,
    a.plate,
    p.district,
    p.lat,
    p.lng,
    case
      when p_lat is null or p_lng is null or p.lat is null or p.lng is null then null
      else 6371 * 2 * asin(sqrt(
        power(sin(radians(p.lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - p_lng) / 2), 2)
      ))
    end as distance_km,
    p.last_seen_at,
    p.photo_path,
    a.rider_number,
    r.rating,
    r.rating_count,
    coalesce(p.busy_until > now(), false) as is_busy
  from profiles p
  join rider_applications a on a.user_id = p.id
  cross join lateral (
    select round(avg(rr.stars)::numeric, 1) as rating, count(*)::int as rating_count
    from rider_ratings rr where rr.rider_id = p.id
  ) r
  where auth.uid() is not null
    and p.role = 'rider'
    and a.status = 'approved'
    and p.is_online
    and p.last_seen_at > now() - interval '10 minutes'
    -- Riders without GPS still show (by neighbourhood); riders with GPS must be inside the city.
    and (p.lat is null or in_service_area(p.lat, p.lng))
    and (is_admin() or p.busy_until is null or p.busy_until <= now())
    -- While paid membership is on, only riders whose membership runs past now.
    and membership_ok(p.id)
  order by distance_km nulls last, (p.district = p_area) desc, p.last_seen_at desc
  limit 50;
$$;

-- Riders reporting online, for admins: the same approval, freshness and service-area rules as
-- nearby_riders, but including busy riders and riders hidden for membership, each labelled.
-- `available` is what customers get: not busy and membership in order.
create or replace function public.admin_online_riders()
returns table (
  id uuid, full_name text, phone text, plate text, area text, lat double precision, lng double precision,
  distance_km double precision, last_seen_at timestamptz, photo_path text, rider_number int,
  rating numeric, rating_count int, is_busy boolean, available boolean, membership_status text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select p.id, p.full_name, p.phone, a.plate, p.district, p.lat, p.lng, null::double precision,
           p.last_seen_at, p.photo_path, a.rider_number, r.rating, r.rating_count,
           coalesce(p.busy_until > now(), false),
           not coalesce(p.busy_until > now(), false) and membership_ok(p.id),
           st.status
    from profiles p
    join rider_applications a on a.user_id = p.id
    cross join lateral (
      select round(avg(rr.stars)::numeric, 1) as rating, count(*)::int as rating_count
      from rider_ratings rr where rr.rider_id = p.id
    ) r
    cross join lateral membership_status_of(p.id) st
    where p.role = 'rider'
      and a.status = 'approved'
      and p.is_online
      and p.last_seen_at > now() - interval '10 minutes'
      and (p.lat is null or in_service_area(p.lat, p.lng))
    order by p.last_seen_at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------------------------------
revoke execute on function
  public.membership_ok(uuid),
  public.membership_status_of(uuid),
  public.guard_rider_membership(),
  public.my_membership(),
  public.admin_rider_memberships(),
  public.admin_set_membership_settings(boolean, numeric, text),
  public.admin_confirm_membership_payment(uuid, numeric, text, text, text, uuid),
  public.admin_membership_history(uuid),
  public.admin_online_riders(),
  public.nearby_riders(double precision, double precision, text)
from public, anon, authenticated;
grant execute on function
  public.my_membership(),
  public.admin_rider_memberships(),
  public.admin_set_membership_settings(boolean, numeric, text),
  public.admin_confirm_membership_payment(uuid, numeric, text, text, text, uuid),
  public.admin_membership_history(uuid),
  public.admin_online_riders(),
  public.nearby_riders(double precision, double precision, text)
to authenticated;
