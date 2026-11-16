-- Request a moto: a customer sends one request (pickup, drop-off, short note); the nearest free riders
-- get it in widening waves; the first to accept takes the job, then marks it picked up and delivered.
-- Calling a rider is unchanged.
--
-- Waves: advance_moto_requests() runs every 10 seconds (pg_cron where available). Wave 1 goes out when
-- the request is made; wave 2 after wave_seconds; the request expires after expire_seconds. Push
-- notifications go through Expo's push service with pg_net. Without pg_cron / pg_net (a local test
-- database) everything else works, and tests call advance_moto_requests() themselves.

-- ---------------------------------------------------------------------------------------------------
-- Settings (one row; admins edit it in the app)
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.request_settings (
  id boolean primary key default true check (id),
  first_radius_km numeric(4, 1) not null default 2.0 check (first_radius_km between 0.5 and 20),
  second_radius_km numeric(4, 1) not null default 4.0 check (second_radius_km between 0.5 and 30),
  riders_per_wave int not null default 4 check (riders_per_wave between 1 and 10),
  wave_seconds int not null default 60 check (wave_seconds between 20 and 600),
  expire_seconds int not null default 180 check (expire_seconds between 60 and 1800),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  check (second_radius_km >= first_radius_km),
  check (expire_seconds > wave_seconds)
);
insert into public.request_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------------
-- Requests, offers, push tokens
-- ---------------------------------------------------------------------------------------------------
do $$ begin
  create type public.request_status as enum ('searching', 'accepted', 'picked_up', 'delivered', 'cancelled', 'expired');
exception when duplicate_object then null;
end $$;

create table if not exists public.moto_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rider_id uuid references public.profiles (id) on delete set null,
  status public.request_status not null default 'searching',
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  pickup_label text check (char_length(pickup_label) <= 80),
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  dropoff_label text check (char_length(dropoff_label) <= 80),
  note text check (char_length(note) <= 140),
  wave smallint not null default 1,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  expired_at timestamptz,
  rated_at timestamptz,
  check (rider_id is null or rider_id <> customer_id)
);
-- One open request per customer, one job per rider.
create unique index if not exists moto_requests_one_open_per_customer on public.moto_requests (customer_id)
  where status in ('searching', 'accepted', 'picked_up');
create unique index if not exists moto_requests_one_job_per_rider on public.moto_requests (rider_id)
  where status in ('accepted', 'picked_up');
create index if not exists moto_requests_searching on public.moto_requests (created_at) where status = 'searching';
create index if not exists moto_requests_created on public.moto_requests (created_at desc);

-- Which riders were offered which request. `outcome` is set when the offer closes:
-- won (this rider accepted), taken (another rider accepted), expired, cancelled.
create table if not exists public.request_offers (
  request_id uuid not null references public.moto_requests (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  wave smallint not null,
  distance_km double precision not null,
  offered_at timestamptz not null default now(),
  skipped_at timestamptz,
  closed_at timestamptz,
  outcome text check (outcome in ('won', 'taken', 'expired', 'cancelled')),
  primary key (request_id, rider_id)
);
create index if not exists request_offers_rider on public.request_offers (rider_id, offered_at desc);

-- A phone's Expo push token belongs to whoever last signed in on it.
create table if not exists public.push_tokens (
  token text primary key check (char_length(token) between 10 and 200),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text check (platform in ('android', 'ios', 'web')),
  language text not null default 'so' check (language in ('so', 'en', 'ar')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user on public.push_tokens (user_id);

-- A rating can now come from a delivered request as well as from a logged call.
alter table public.rider_ratings add column if not exists request_id uuid references public.moto_requests (id) on delete set null;

-- ---------------------------------------------------------------------------------------------------
-- Access: reads through these rules (and the functions below); every write goes through a function.
-- ---------------------------------------------------------------------------------------------------
alter table public.request_settings enable row level security;
alter table public.moto_requests enable row level security;
alter table public.request_offers enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists "admins read request settings" on public.request_settings;
create policy "admins read request settings" on public.request_settings for select to authenticated using (public.is_admin());

drop policy if exists "read own requests" on public.moto_requests;
create policy "read own requests" on public.moto_requests for select to authenticated
  using (customer_id = auth.uid() or rider_id = auth.uid() or public.is_admin());

drop policy if exists "riders read own offers" on public.request_offers;
create policy "riders read own offers" on public.request_offers for select to authenticated
  using (rider_id = auth.uid() or public.is_admin());

drop policy if exists "read own push tokens" on public.push_tokens;
create policy "read own push tokens" on public.push_tokens for select to authenticated using (user_id = auth.uid());

revoke all on public.request_settings, public.moto_requests, public.request_offers, public.push_tokens from anon;
revoke insert, update, delete, truncate on public.request_settings, public.moto_requests, public.request_offers, public.push_tokens
  from authenticated;

-- Phones follow requests and offers live.
do $$ begin
  alter publication supabase_realtime add table public.moto_requests;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.request_offers;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------
create or replace function public.km_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
  ));
$$;

/** True while the rider has an accepted or picked-up request: they count as busy. */
create or replace function public.on_active_request(p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from moto_requests where rider_id = p_rider_id and status in ('accepted', 'picked_up'));
$$;

/** Sends push notifications to these people's phones through Expo. Never fails the caller. */
create or replace function public.send_push(p_user_ids uuid[], p_title_so text, p_body_so text, p_title_en text, p_body_en text, p_data jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v_messages jsonb; v_count int;
begin
  select jsonb_agg(jsonb_build_object(
           'to', t.token,
           'title', case when t.language = 'so' then p_title_so else p_title_en end,
           'body', case when t.language = 'so' then p_body_so else p_body_en end,
           'data', coalesce(p_data, '{}'::jsonb),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'requests')),
         count(*)
    into v_messages, v_count
  from push_tokens t where t.user_id = any (p_user_ids);
  if coalesce(v_count, 0) = 0 or to_regnamespace('net') is null then return 0; end if;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  exception when others then
    raise warning 'send_push failed: %', sqlerrm;
    return 0;
  end;
  return v_count;
end;
$$;

-- Riders who may get this request now: the same riders customers see (approved, online, seen in the
-- last 10 minutes, inside the city, not busy, membership in order), with a position, not on a job,
-- not the customer, not offered it already; nearest first within the radius.
create or replace function public.request_candidates(p_request_id uuid, p_radius_km numeric, p_limit int)
returns table (rider_id uuid, distance_km double precision)
language sql stable security definer set search_path = public as $$
  select p.id, d.km
  from moto_requests r
  join profiles p on p.role = 'rider' and p.id <> r.customer_id
  join rider_applications a on a.user_id = p.id and a.status = 'approved'
  cross join lateral (select km_between(r.pickup_lat, r.pickup_lng, p.lat, p.lng) as km) d
  where r.id = p_request_id
    and p.is_online
    and p.last_seen_at > now() - interval '10 minutes'
    and p.lat is not null and in_service_area(p.lat, p.lng)
    and (p.busy_until is null or p.busy_until <= now())
    and membership_ok(p.id)
    and not on_active_request(p.id)
    and not exists (select 1 from request_offers o where o.request_id = r.id and o.rider_id = p.id)
    and d.km <= p_radius_km
  order by d.km, p.last_seen_at desc
  limit p_limit;
$$;

/** Offers the request to the next riders (one wave) and notifies them. Returns how many got it. */
create or replace function public.send_request_wave(p_request_id uuid, p_wave int)
returns int language plpgsql security definer set search_path = public as $$
declare s request_settings; r moto_requests; v_ids uuid[]; v_km double precision;
begin
  select * into s from request_settings;
  select * into r from moto_requests where id = p_request_id;
  if r.status <> 'searching' then return 0; end if;

  with c as (
    select * from request_candidates(p_request_id, case when p_wave = 1 then s.first_radius_km else s.second_radius_km end, s.riders_per_wave)
  ), ins as (
    insert into request_offers (request_id, rider_id, wave, distance_km)
    select p_request_id, c.rider_id, p_wave, c.distance_km from c
    returning rider_id, distance_km
  )
  select array_agg(rider_id), min(distance_km) into v_ids, v_km from ins;
  update moto_requests set wave = greatest(wave, p_wave) where id = p_request_id;

  if v_ids is not null then
    perform send_push(
      v_ids,
      'Dalab mooto oo cusub', coalesce(r.pickup_label, 'Meel kuu dhow') || ' → ' || coalesce(r.dropoff_label, '…') || coalesce('. "' || r.note || '"', ''),
      'New moto request', coalesce(r.pickup_label, 'Near you') || ' → ' || coalesce(r.dropoff_label, '…') || coalesce('. "' || r.note || '"', ''),
      jsonb_build_object('type', 'request', 'request_id', r.id, 'url', '/rider')
    );
  end if;
  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

-- Closes the open offers of a request with an outcome (won for the accepting rider).
create or replace function public.close_request_offers(p_request_id uuid, p_outcome text, p_winner uuid default null)
returns void language sql security definer set search_path = public as $$
  update request_offers
  set closed_at = now(), outcome = case when rider_id = p_winner then 'won' else p_outcome end
  where request_id = p_request_id and closed_at is null;
$$;

-- ---------------------------------------------------------------------------------------------------
-- The clock: waves and expiry. Run every 10 seconds by pg_cron; tests call it directly.
-- ---------------------------------------------------------------------------------------------------
create or replace function public.advance_moto_requests()
returns int language plpgsql security definer set search_path = public as $$
declare s request_settings; r moto_requests; v_age double precision; v_changed int := 0;
begin
  select * into s from request_settings;
  for r in select * from moto_requests where status = 'searching' order by created_at for update skip locked loop
    v_age := extract(epoch from now() - r.created_at);
    if v_age >= s.expire_seconds then
      update moto_requests set status = 'expired', expired_at = now() where id = r.id;
      perform close_request_offers(r.id, 'expired');
      perform send_push(array[r.customer_id],
        'Weli cidna ma aqbalin', 'Wac mid ka mid ah darawallada kuu dhow.',
        'No moto accepted yet', 'Call one of the riders near you.',
        jsonb_build_object('type', 'request-expired', 'request_id', r.id, 'url', '/request/' || r.id));
      v_changed := v_changed + 1;
    elsif v_age >= s.wave_seconds and r.wave < 2 then
      perform send_request_wave(r.id, 2);
      v_changed := v_changed + 1;
    end if;
  end loop;
  return v_changed;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Customer
-- ---------------------------------------------------------------------------------------------------
create or replace function public.create_moto_request(
  p_pickup_lat double precision, p_pickup_lng double precision, p_pickup_label text,
  p_dropoff_lat double precision, p_dropoff_lng double precision, p_dropoff_label text,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_note text := nullif(btrim(p_note), '');
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles where id = v_uid and role = 'customer') then
    raise exception 'only customers can request a moto';
  end if;
  if not in_service_area(p_pickup_lat, p_pickup_lng) then raise exception 'pickup is outside the service area'; end if;
  if p_dropoff_lat is null or p_dropoff_lng is null or p_dropoff_lat not between -90 and 90 or p_dropoff_lng not between -180 and 180 then
    raise exception 'drop-off is missing';
  end if;
  if char_length(v_note) > 140 then raise exception 'note is too long'; end if;
  if exists (select 1 from moto_requests where customer_id = v_uid and status in ('searching', 'accepted', 'picked_up')) then
    raise exception 'you already have an open request';
  end if;
  if not consume_rate_limit('moto-request', v_uid::text, 10, interval '1 hour') then
    raise exception 'too many requests, try again later';
  end if;

  insert into moto_requests (customer_id, pickup_lat, pickup_lng, pickup_label, dropoff_lat, dropoff_lng, dropoff_label, note)
  values (v_uid, p_pickup_lat, p_pickup_lng, left(nullif(btrim(p_pickup_label), ''), 80), p_dropoff_lat, p_dropoff_lng,
          left(nullif(btrim(p_dropoff_label), ''), 80), v_note)
  returning id into v_id;

  -- Wave 1 at once. If nobody is that close, widen straight away instead of waiting a minute.
  if send_request_wave(v_id, 1) = 0 then
    perform send_request_wave(v_id, 2);
  end if;
  return v_id;
end;
$$;

-- The customer cancels before pickup; an admin can cancel any open request.
create or replace function public.cancel_moto_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r moto_requests;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into r from moto_requests where id = p_request_id for update;
  if not found or (r.customer_id <> v_uid and not is_admin()) then raise exception 'request not found'; end if;
  if r.status not in ('searching', 'accepted', 'picked_up') then raise exception 'request is already closed'; end if;
  if r.status = 'picked_up' and not is_admin() then raise exception 'the rider already picked it up: call the rider'; end if;

  update moto_requests set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid where id = r.id;
  perform close_request_offers(r.id, 'cancelled');
  if r.rider_id is not null then
    perform send_push(array[r.rider_id],
      'Dalabka waa la joojiyay', 'Macmiilka ayaa joojiyay dalabka.',
      'Request cancelled', 'The customer cancelled the request.',
      jsonb_build_object('type', 'request-cancelled', 'request_id', r.id, 'url', '/rider'));
  end if;
end;
$$;

-- One request with what the viewer may see: the customer, the assigned rider, or an admin.
-- The customer sees the rider's details once accepted, and the rider's position only until delivery.
-- The rider sees the customer's name and number once they accepted.
create or replace function public.moto_request_detail(p_request_id uuid)
returns table (
  id uuid, status public.request_status, wave smallint,
  pickup_lat double precision, pickup_lng double precision, pickup_label text,
  dropoff_lat double precision, dropoff_lng double precision, dropoff_label text, note text,
  created_at timestamptz, accepted_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz,
  cancelled_at timestamptz, expired_at timestamptz, expires_at timestamptz, rated_at timestamptz,
  offered_count int, wave1_count int, wave2_count int,
  rider_id uuid, rider_name text, rider_phone text, rider_photo_path text, rider_number int, rider_plate text,
  rider_rating numeric, rider_rating_count int, rider_lat double precision, rider_lng double precision, rider_seen_at timestamptz,
  customer_name text, customer_phone text, can_rate boolean
) language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r moto_requests; s request_settings; v_customer boolean; v_rider boolean;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into r from moto_requests m where m.id = p_request_id;
  if not found then raise exception 'request not found'; end if;
  v_customer := r.customer_id = v_uid;
  v_rider := r.rider_id = v_uid;
  if not (v_customer or v_rider or is_admin()) then raise exception 'request not found'; end if;
  select * into s from request_settings;

  return query
  select r.id, r.status, r.wave,
         r.pickup_lat, r.pickup_lng, r.pickup_label, r.dropoff_lat, r.dropoff_lng, r.dropoff_label, r.note,
         r.created_at, r.accepted_at, r.picked_up_at, r.delivered_at, r.cancelled_at, r.expired_at,
         r.created_at + make_interval(secs => s.expire_seconds), r.rated_at,
         (select count(*)::int from request_offers o where o.request_id = r.id),
         (select count(*)::int from request_offers o where o.request_id = r.id and o.wave = 1),
         (select count(*)::int from request_offers o where o.request_id = r.id and o.wave = 2),
         r.rider_id, rp.full_name, rp.phone, rp.photo_path, ra.rider_number, ra.plate,
         rt.rating, rt.rating_count,
         case when r.status in ('accepted', 'picked_up') then rp.lat end,
         case when r.status in ('accepted', 'picked_up') then rp.lng end,
         case when r.status in ('accepted', 'picked_up') then rp.last_seen_at end,
         case when not v_customer then cp.full_name end,
         case when not v_customer and r.status in ('accepted', 'picked_up', 'delivered') then cp.phone end,
         v_customer and r.status = 'delivered' and r.rated_at is null and r.delivered_at > now() - interval '3 days'
  from (select 1) one
  left join profiles rp on rp.id = r.rider_id
  left join rider_applications ra on ra.user_id = r.rider_id
  left join profiles cp on cp.id = r.customer_id
  left join lateral (
    select round(avg(x.stars)::numeric, 1) as rating, count(*)::int as rating_count from rider_ratings x where x.rider_id = r.rider_id
  ) rt on true;
end;
$$;

/** The customer's open request, or their latest delivered one still waiting for a rating. */
create or replace function public.my_moto_request()
returns uuid language sql stable security definer set search_path = public as $$
  select id from moto_requests
  where customer_id = auth.uid()
    and (status in ('searching', 'accepted', 'picked_up')
         or (status = 'delivered' and rated_at is null and delivered_at > now() - interval '3 days'))
  order by (status in ('searching', 'accepted', 'picked_up')) desc, created_at desc
  limit 1;
$$;

-- Rates (1–5) or skips (null) a delivered request. A rating becomes this customer's one current rating
-- of the rider, exactly like a rating after a Call.
create or replace function public.rate_request(p_request_id uuid, p_stars int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r moto_requests;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_stars is not null and (p_stars < 1 or p_stars > 5) then raise exception 'stars must be 1 to 5'; end if;
  select * into r from moto_requests
  where id = p_request_id and customer_id = v_uid and status = 'delivered' and rated_at is null
    and delivered_at > now() - interval '3 days'
  for update;
  if not found then raise exception 'request not found'; end if;

  update moto_requests set rated_at = now() where id = r.id;
  if p_stars is not null then
    insert into rider_ratings (rider_id, customer_id, stars, request_id)
    values (r.rider_id, r.customer_id, p_stars, r.id)
    on conflict (rider_id, customer_id) do update
      set stars = excluded.stars, request_id = excluded.request_id, call_id = null, updated_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Rider
-- ---------------------------------------------------------------------------------------------------
-- Open offers for the signed-in rider, plus ones closed in the last 30 seconds (so the app can say
-- "another rider took this"). Before accepting, riders see places, distances and the note only.
create or replace function public.my_request_offers()
returns table (
  request_id uuid, wave smallint, distance_km double precision, trip_km double precision,
  pickup_label text, dropoff_label text, note text, offered_at timestamptz, expires_at timestamptz,
  closed_at timestamptz, outcome text
) language sql stable security definer set search_path = public as $$
  select o.request_id, o.wave, o.distance_km,
         km_between(r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng),
         r.pickup_label, r.dropoff_label, r.note, o.offered_at,
         r.created_at + make_interval(secs => (select expire_seconds from request_settings)),
         o.closed_at, o.outcome
  from request_offers o
  join moto_requests r on r.id = o.request_id
  where o.rider_id = auth.uid()
    and o.skipped_at is null
    and (o.closed_at is null or (o.closed_at > now() - interval '30 seconds' and o.outcome = 'taken'))
  order by o.offered_at desc;
$$;

-- Accepts a request. The request row is locked, so when two riders tap at once exactly one gets it.
-- Returns 'ok', or why not: 'taken', 'closed', 'busy'.
create or replace function public.accept_moto_request(p_request_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r moto_requests; v_name text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if not is_approved_rider() then raise exception 'only approved riders can accept requests'; end if;
  if not exists (select 1 from request_offers where request_id = p_request_id and rider_id = v_uid and skipped_at is null) then
    raise exception 'request not found';
  end if;

  select * into r from moto_requests where id = p_request_id for update;
  if r.status in ('accepted', 'picked_up', 'delivered') then return 'taken'; end if;
  if r.status <> 'searching' then return 'closed'; end if;
  if on_active_request(v_uid) then return 'busy'; end if;

  update moto_requests set status = 'accepted', rider_id = v_uid, accepted_at = now() where id = r.id;
  perform close_request_offers(r.id, 'taken', v_uid);

  select full_name into v_name from profiles where id = v_uid;
  perform send_push(array[r.customer_id],
    'Mootadaadu way soo socotaa', coalesce(v_name, 'Darawal') || ' ayaa aqbalay dalabkaaga.',
    'Your moto is coming', coalesce(v_name, 'A rider') || ' accepted your request.',
    jsonb_build_object('type', 'request-accepted', 'request_id', r.id, 'url', '/request/' || r.id));
  return 'ok';
end;
$$;

create or replace function public.skip_moto_request(p_request_id uuid)
returns void language sql security definer set search_path = public as $$
  update request_offers set skipped_at = now()
  where request_id = p_request_id and rider_id = auth.uid() and skipped_at is null and closed_at is null;
$$;

/** The signed-in rider's current job, if any. */
create or replace function public.my_active_job()
returns uuid language sql stable security definer set search_path = public as $$
  select id from moto_requests where rider_id = auth.uid() and status in ('accepted', 'picked_up') limit 1;
$$;

-- The assigned rider moves the job along: accepted → picked_up → delivered.
create or replace function public.update_request_status(p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r moto_requests;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into r from moto_requests where id = p_request_id and rider_id = v_uid for update;
  if not found then raise exception 'request not found'; end if;

  if p_status = 'picked_up' and r.status = 'accepted' then
    update moto_requests set status = 'picked_up', picked_up_at = now() where id = r.id;
    perform send_push(array[r.customer_id],
      'Waa la qaaday', 'Darawalku wuxuu qaaday alaabtaada.',
      'Picked up', 'The rider picked up your delivery.',
      jsonb_build_object('type', 'request-picked-up', 'request_id', r.id, 'url', '/request/' || r.id));
  elsif p_status = 'delivered' and r.status = 'picked_up' then
    update moto_requests set status = 'delivered', delivered_at = now() where id = r.id;
    perform send_push(array[r.customer_id],
      'La geeyay', 'Alaabtaada waa la geeyay. Qiimee darawalka.',
      'Delivered', 'Your delivery arrived. Rate the rider.',
      jsonb_build_object('type', 'request-delivered', 'request_id', r.id, 'url', '/request/' || r.id));
  else
    raise exception 'cannot change % to %', r.status, p_status;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Push tokens
-- ---------------------------------------------------------------------------------------------------
create or replace function public.save_push_token(p_token text, p_platform text, p_language text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'no profile'; end if;
  insert into push_tokens (token, user_id, platform, language, updated_at)
  values (p_token, auth.uid(), p_platform, coalesce(nullif(p_language, ''), 'so'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, language = excluded.language, updated_at = now();
end;
$$;

create or replace function public.remove_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------------------------------
create or replace function public.admin_requests(p_limit int default 100)
returns table (
  id uuid, status public.request_status, wave smallint, created_at timestamptz, accepted_at timestamptz,
  picked_up_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz, expired_at timestamptz,
  customer_id uuid, customer_name text, rider_id uuid, rider_name text, rider_number int,
  pickup_label text, dropoff_label text, offered_count int
) language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select r.id, r.status, r.wave, r.created_at, r.accepted_at, r.picked_up_at, r.delivered_at, r.cancelled_at, r.expired_at,
           r.customer_id, c.full_name, r.rider_id, rp.full_name, a.rider_number,
           r.pickup_label, r.dropoff_label,
           (select count(*)::int from request_offers o where o.request_id = r.id)
    from moto_requests r
    join profiles c on c.id = r.customer_id
    left join profiles rp on rp.id = r.rider_id
    left join rider_applications a on a.user_id = r.rider_id
    order by r.created_at desc
    limit least(greatest(p_limit, 1), 500);
end;
$$;

create or replace function public.admin_request_stats(p_since timestamptz)
returns table (sent int, accepted int, delivered int, expired int, cancelled int, open int, avg_accept_seconds int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  return query
    select count(*)::int,
           count(*) filter (where r.accepted_at is not null)::int,
           count(*) filter (where r.status = 'delivered')::int,
           count(*) filter (where r.status = 'expired')::int,
           count(*) filter (where r.status = 'cancelled')::int,
           count(*) filter (where r.status in ('searching', 'accepted', 'picked_up'))::int,
           round(avg(extract(epoch from r.accepted_at - r.created_at)) filter (where r.accepted_at is not null))::int
    from moto_requests r where r.created_at >= p_since;
end;
$$;

create or replace function public.admin_set_request_settings(
  p_first_radius_km numeric, p_second_radius_km numeric, p_riders_per_wave int, p_wave_seconds int, p_expire_seconds int
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update request_settings
  set first_radius_km = p_first_radius_km, second_radius_km = p_second_radius_km, riders_per_wave = p_riders_per_wave,
      wave_seconds = p_wave_seconds, expire_seconds = p_expire_seconds, updated_at = now(), updated_by = auth.uid()
  where id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- A rider on a job is busy: hidden from customers' list and counted busy for admins.
-- nearby_riders and admin_online_riders as in 20261010000000_rider_membership.sql, plus that rule.
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
      else km_between(p_lat, p_lng, p.lat, p.lng)
    end as distance_km,
    p.last_seen_at,
    p.photo_path,
    a.rider_number,
    r.rating,
    r.rating_count,
    coalesce(p.busy_until > now(), false) or on_active_request(p.id) as is_busy
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
    and (is_admin() or ((p.busy_until is null or p.busy_until <= now()) and not on_active_request(p.id)))
    -- While paid membership is on, only riders whose membership runs past now.
    and membership_ok(p.id)
  order by distance_km nulls last, (p.district = p_area) desc, p.last_seen_at desc
  limit 50;
$$;

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
           b.busy,
           not b.busy and membership_ok(p.id),
           st.status
    from profiles p
    join rider_applications a on a.user_id = p.id
    cross join lateral (
      select round(avg(rr.stars)::numeric, 1) as rating, count(*)::int as rating_count
      from rider_ratings rr where rr.rider_id = p.id
    ) r
    cross join lateral (select coalesce(p.busy_until > now(), false) or on_active_request(p.id) as busy) b
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
  public.km_between(double precision, double precision, double precision, double precision),
  public.on_active_request(uuid),
  public.send_push(uuid[], text, text, text, text, jsonb),
  public.request_candidates(uuid, numeric, int),
  public.send_request_wave(uuid, int),
  public.close_request_offers(uuid, text, uuid),
  public.advance_moto_requests(),
  public.create_moto_request(double precision, double precision, text, double precision, double precision, text, text),
  public.cancel_moto_request(uuid),
  public.moto_request_detail(uuid),
  public.my_moto_request(),
  public.rate_request(uuid, int),
  public.my_request_offers(),
  public.accept_moto_request(uuid),
  public.skip_moto_request(uuid),
  public.my_active_job(),
  public.update_request_status(uuid, text),
  public.save_push_token(text, text, text),
  public.remove_push_token(text),
  public.admin_requests(int),
  public.admin_request_stats(timestamptz),
  public.admin_set_request_settings(numeric, numeric, int, int, int),
  public.nearby_riders(double precision, double precision, text),
  public.admin_online_riders()
from public, anon, authenticated;
grant execute on function
  public.create_moto_request(double precision, double precision, text, double precision, double precision, text, text),
  public.cancel_moto_request(uuid),
  public.moto_request_detail(uuid),
  public.my_moto_request(),
  public.rate_request(uuid, int),
  public.my_request_offers(),
  public.accept_moto_request(uuid),
  public.skip_moto_request(uuid),
  public.my_active_job(),
  public.update_request_status(uuid, text),
  public.save_push_token(text, text, text),
  public.remove_push_token(text),
  public.admin_requests(int),
  public.admin_request_stats(timestamptz),
  public.admin_set_request_settings(numeric, numeric, int, int, int),
  public.nearby_riders(double precision, double precision, text),
  public.admin_online_riders()
to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Scheduler and push transport (Supabase projects; skipped on a database without them)
-- ---------------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('advance-moto-requests', '10 seconds', 'select public.advance_moto_requests()');
  end if;
end $$;
