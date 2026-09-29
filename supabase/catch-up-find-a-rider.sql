-- One-step catch-up for the find-a-rider version. Safe to run more than once, and safe whether or not
-- the 20260929, 20260930 and 20261001 migrations were already applied. It ends in the same state.

alter table public.profiles add column if not exists lat double precision check (lat between -90 and 90);
alter table public.profiles add column if not exists lng double precision check (lng between -180 and 180);
alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.in_service_area(p_lat double precision, p_lng double precision)
returns boolean language sql immutable as $$
  select p_lat is not null and p_lng is not null and (
    -- Hargeisa
    (p_lat between 9.47 and 9.64 and p_lng between 43.95 and 44.17)
  );
$$;

drop function if exists public.nearby_riders(double precision, double precision, text);

create function public.nearby_riders(
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
  last_seen_at timestamptz
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
    p.last_seen_at
  from profiles p
  join rider_applications a on a.user_id = p.id
  where auth.uid() is not null
    and p.role = 'rider'
    and a.status = 'approved'
    and p.is_online
    and p.last_seen_at > now() - interval '10 minutes'
    and (p.lat is null or in_service_area(p.lat, p.lng))
  order by distance_km nulls last, (p.district = p_area) desc, p.last_seen_at desc
  limit 50;
$$;

revoke execute on function public.nearby_riders from public, anon;
grant execute on function public.nearby_riders to authenticated;
