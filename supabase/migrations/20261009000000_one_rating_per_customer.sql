-- Ratings that can't be stuffed: each customer has one current rating per rider.
--
-- A logged call is only a tap on the Call button: it is not proof that a call connected or that a
-- delivery happened. It is used only to decide who may rate: a customer may rate a rider after tapping
-- Call on them (from 3 minutes to 3 days later). Rating again after a later call replaces their
-- earlier rating instead of adding another. Riders can't log calls to themselves or rate themselves.
-- Existing ratings are carried over: each customer's latest rating of each rider. Safe to run more than once.

create table if not exists public.rider_ratings (
  rider_id uuid not null references public.profiles (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  -- The logged call that made this rating possible.
  call_id uuid references public.calls (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rider_id, customer_id),
  check (rider_id <> customer_id)
);
alter table public.rider_ratings enable row level security;

-- Customers see their own ratings and admins see all. Riders see only their average (my_rating), not
-- who gave which stars.
drop policy if exists "read own or admin ratings" on public.rider_ratings;
create policy "read own or admin ratings" on public.rider_ratings for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

insert into public.rider_ratings (rider_id, customer_id, stars, call_id, created_at, updated_at)
select distinct on (c.rider_id, c.caller_id) c.rider_id, c.caller_id, c.stars, c.id, c.rated_at, c.rated_at
from public.calls c
join public.profiles p on p.id = c.caller_id and p.role = 'customer'
where c.stars is not null and c.caller_id <> c.rider_id
order by c.rider_id, c.caller_id, c.rated_at desc nulls last, c.created_at desc
on conflict (rider_id, customer_id) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- Logging a Call tap
-- ---------------------------------------------------------------------------------------------------
-- Only customers log taps, never on themselves. Repeated taps on the same rider within 2 minutes count
-- once, and at most 30 taps an hour are logged per customer.
create or replace function public.log_call(p_rider_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_rider_id = v_uid then raise exception 'cannot call yourself'; end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'customer') then
    raise exception 'only customers can log calls';
  end if;
  if not exists (
    select 1 from rider_applications where user_id = p_rider_id and status = 'approved'
  ) then raise exception 'rider is not approved'; end if;
  if exists (
    select 1 from calls where caller_id = v_uid and rider_id = p_rider_id and created_at > now() - interval '2 minutes'
  ) then return; end if;
  if not consume_rate_limit('call-log', v_uid::text, 30, interval '1 hour') then return; end if;
  insert into calls (caller_id, rider_id) values (v_uid, p_rider_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Rating
-- ---------------------------------------------------------------------------------------------------
-- The caller's latest logged call that may still be rated: 3 minutes to 3 days old, by a customer,
-- not on themselves.
create or replace function public.call_to_rate()
returns table (call_id uuid, rider_id uuid, full_name text, photo_path text, rider_number int, called_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.rider_id, p.full_name, p.photo_path, a.rider_number, c.created_at
  from calls c
  join profiles p on p.id = c.rider_id
  join profiles me on me.id = c.caller_id and me.role = 'customer'
  left join rider_applications a on a.user_id = c.rider_id
  where c.caller_id = auth.uid()
    and c.caller_id <> c.rider_id
    and c.rated_at is null
    and c.created_at < now() - interval '3 minutes'
    and c.created_at > now() - interval '3 days'
  order by c.created_at desc
  limit 1;
$$;

-- Rates (1–5) or skips (null) one eligible logged call. A rating becomes this customer's one current
-- rating of the rider. Older unrated calls are closed too, so the prompt shows once.
create or replace function public.rate_call(p_call_id uuid, p_stars int default null)
returns void language plpgsql security definer set search_path = public as $$
declare c calls;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then raise exception 'stars must be 1 to 5'; end if;
  select * into c from calls
  where id = p_call_id and caller_id = auth.uid() and rated_at is null
    and caller_id <> rider_id
    and created_at < now() - interval '3 minutes'
    and created_at > now() - interval '3 days'
  for update;
  if not found then raise exception 'call not found'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and role = 'customer') then
    raise exception 'only customers can rate';
  end if;

  update calls set stars = p_stars, rated_at = now() where id = c.id;
  if p_stars is not null then
    insert into rider_ratings (rider_id, customer_id, stars, call_id)
    values (c.rider_id, c.caller_id, p_stars, c.id)
    on conflict (rider_id, customer_id) do update
      set stars = excluded.stars, call_id = excluded.call_id, updated_at = now();
  end if;
  update calls set rated_at = now()
  where caller_id = auth.uid() and rated_at is null and created_at <= c.created_at;
end;
$$;

/** The signed-in rider's average and number of ratings. */
create or replace function public.my_rating()
returns table (rating numeric, rating_count int)
language sql stable security definer set search_path = public as $$
  select round(avg(stars)::numeric, 1), count(*)::int from rider_ratings where rider_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------------------------------
-- nearby_riders: ratings now come from rider_ratings (one per customer)
-- ---------------------------------------------------------------------------------------------------
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
  order by distance_km nulls last, (p.district = p_area) desc, p.last_seen_at desc
  limit 50;
$$;

revoke execute on function
  public.log_call(uuid), public.call_to_rate(), public.rate_call(uuid, int), public.my_rating(),
  public.nearby_riders(double precision, double precision, text)
from public, anon;
grant execute on function
  public.log_call(uuid), public.call_to_rate(), public.rate_call(uuid, int), public.my_rating(),
  public.nearby_riders(double precision, double precision, text)
to authenticated;
