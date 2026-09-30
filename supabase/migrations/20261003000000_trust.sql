-- Trust features: a face photo and a Jareeye number (JRY-001) for every approved driver, a "busy" state
-- that hides a driver while they deliver, and 1–5 star ratings after a call. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Face photo and busy state on the profile
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists photo_path text;
-- While set and in the future, the driver is on a delivery and hidden from customers.
alter table public.profiles add column if not exists busy_until timestamptz;

-- Face photos are shown to customers, so the bucket is public; drivers can only write their own folder.
insert into storage.buckets (id, name, public) values ('rider-photos', 'rider-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "riders upload own face photo" on storage.objects;
create policy "riders upload own face photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'rider-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "riders replace own face photo" on storage.objects;
create policy "riders replace own face photo" on storage.objects for update to authenticated
  using (bucket_id = 'rider-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "riders delete own face photo" on storage.objects;
create policy "riders delete own face photo" on storage.objects for delete to authenticated
  using (bucket_id = 'rider-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Jareeye number, given once when a driver is first approved
-- ---------------------------------------------------------------------------
create sequence if not exists public.rider_number_seq;
alter table public.rider_applications add column if not exists rider_number int unique;

-- Number the drivers approved before this migration, in the order they were approved.
do $$
declare r record;
begin
  for r in
    select user_id from public.rider_applications
    where status = 'approved' and rider_number is null
    order by coalesce(reviewed_at, created_at)
  loop
    update public.rider_applications set rider_number = nextval('public.rider_number_seq') where user_id = r.user_id;
  end loop;
end;
$$;

-- Only admins (through review_rider) or the SQL editor may set a number.
create or replace function public.guard_rider_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rider_number is distinct from (case when tg_op = 'UPDATE' then old.rider_number end)
     and auth.uid() is not null and not is_admin() then
    raise exception 'rider number cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists rider_applications_guard_number on public.rider_applications;
create trigger rider_applications_guard_number before insert or update on public.rider_applications
  for each row execute function public.guard_rider_number();

create or replace function public.review_rider(p_user_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update rider_applications
  set status = case when p_approve then 'approved'::application_status else 'rejected'::application_status end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      rider_number = case when p_approve then coalesce(rider_number, nextval('rider_number_seq')::int) else rider_number end
  where user_id = p_user_id;
  if not found then raise exception 'application not found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ratings: stored on the call they are about
-- ---------------------------------------------------------------------------
alter table public.calls add column if not exists stars smallint check (stars between 1 and 5);
-- Set when the caller rates or skips; skipped calls keep stars null.
alter table public.calls add column if not exists rated_at timestamptz;

-- The caller's most recent call that still needs a rating: a few minutes old (time to meet the driver)
-- and at most three days old.
create or replace function public.call_to_rate()
returns table (call_id uuid, rider_id uuid, full_name text, photo_path text, rider_number int, called_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.rider_id, p.full_name, p.photo_path, a.rider_number, c.created_at
  from calls c
  join profiles p on p.id = c.rider_id
  left join rider_applications a on a.user_id = c.rider_id
  where c.caller_id = auth.uid()
    and c.rated_at is null
    and c.created_at < now() - interval '3 minutes'
    and c.created_at > now() - interval '3 days'
  order by c.created_at desc
  limit 1;
$$;

-- Rates (1–5) or skips (null) a call. Older unrated calls are dropped too, so the prompt shows once.
create or replace function public.rate_call(p_call_id uuid, p_stars int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_created timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then raise exception 'stars must be 1 to 5'; end if;
  update calls set stars = p_stars, rated_at = now()
  where id = p_call_id and caller_id = auth.uid() and rated_at is null
  returning created_at into v_created;
  if not found then raise exception 'call not found'; end if;
  update calls set rated_at = now()
  where caller_id = auth.uid() and rated_at is null and created_at <= v_created;
end;
$$;

revoke execute on function public.call_to_rate(), public.rate_call(uuid, int) from public, anon;
grant execute on function public.call_to_rate(), public.rate_call(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- nearby_riders: adds photo, number, rating and busy; busy drivers are hidden from everyone but admins
-- ---------------------------------------------------------------------------
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
    select round(avg(c.stars)::numeric, 1) as rating, count(c.stars)::int as rating_count
    from calls c where c.rider_id = p.id and c.stars is not null
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

revoke execute on function public.nearby_riders(double precision, double precision, text) from public, anon;
grant execute on function public.nearby_riders(double precision, double precision, text) to authenticated;
