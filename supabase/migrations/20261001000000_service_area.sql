-- Service area: Jareeye runs in Hargeisa for now. Riders whose position is outside the city are not
-- shown. Add another city (for example Mogadishu) as another "or" box, and in src/lib/service-area.ts.

create or replace function public.in_service_area(p_lat double precision, p_lng double precision)
returns boolean language sql immutable as $$
  select p_lat is not null and p_lng is not null and (
    -- Hargeisa
    (p_lat between 9.47 and 9.64 and p_lng between 43.95 and 44.17)
  );
$$;

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
    -- Riders without GPS still show (by neighbourhood); riders with GPS must be inside the city.
    and (p.lat is null or in_service_area(p.lat, p.lng))
  order by distance_km nulls last, (p.district = p_area) desc, p.last_seen_at desc
  limit 50;
$$;
