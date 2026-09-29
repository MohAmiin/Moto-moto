-- Find-a-rider: people see approved riders who are online nearby and call them directly.

-- Riders share their position while the app is open and online. last_seen_at is refreshed
-- every minute, so a rider who closes the app drops off the list after a few minutes.
alter table public.profiles
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column last_seen_at timestamptz;

-- Online, approved riders seen in the last 10 minutes, nearest first.
-- Without a location, riders in the caller's neighbourhood come first.
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
  distance_km double precision,
  last_seen_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.full_name,
    p.phone,
    a.plate,
    p.district,
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
  order by distance_km nulls last, (p.district = p_area) desc, p.last_seen_at desc
  limit 30;
$$;

revoke execute on function public.nearby_riders from public, anon;
grant execute on function public.nearby_riders to authenticated;
