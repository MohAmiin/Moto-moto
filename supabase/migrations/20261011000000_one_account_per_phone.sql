-- One account per phone number, whatever way the number was typed.
--
-- canonical_phone() turns the forms people use (4421785, 634421785, 0634421785, +252634421785,
-- 00252 63 442 1785) into one: 252 + the 9-digit national number. Profiles and PIN credentials are unique
-- on that form, sign-up checks every place a number can live (PIN login address, SMS login phone, profile,
-- PIN credential), and admin phone corrections go through one function that checks and locks.
--
-- Existing accounts that already share a number are reported, not merged: the migration stops and lists
-- them (see phone_conflicts()), so an admin can decide. Plates are not unique and stay that way.

create or replace function public.canonical_phone(p text)
returns text language sql immutable parallel safe as $$
  select case when d = '' then null else '252' || case when length(d) = 7 then '63' || d else d end end
  from (select regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '^(00)?252', ''), '^0', '') as d) x;
$$;

-- Accounts that share a number in any of the places a number is kept.
create or replace function public.phone_conflicts()
returns table (phone text, user_ids uuid[], sources text[])
language sql stable security definer set search_path = public, auth as $$
  with numbers as (
    select u.id, 'login' as src, canonical_phone(split_part(u.email, '@', 1)) as phone
    from auth.users u where u.email like '%@pin.jareeye.app'
    union all select u.id, 'sms', canonical_phone(u.phone) from auth.users u where coalesce(u.phone, '') <> ''
    union all select p.id, 'profile', canonical_phone(p.phone) from profiles p where p.phone is not null
    union all select c.user_id, 'pin', canonical_phone(c.phone) from pin_credentials c
  )
  select n.phone, array_agg(distinct n.id), array_agg(distinct n.src || ':' || n.id::text)
  from numbers n where n.phone is not null
  group by n.phone having count(distinct n.id) > 1;
$$;

do $$
declare r record; v_list text := '';
begin
  for r in select * from phone_conflicts() loop
    v_list := v_list || format(E'\n  %s: %s', r.phone, array_to_string(r.user_ids, ', '));
  end loop;
  if v_list <> '' then
    raise exception 'These accounts share a phone number. Resolve them (nothing was changed), then run this migration again:%', v_list;
  end if;
end $$;

create unique index if not exists profiles_phone_canonical on public.profiles (public.canonical_phone(phone)) where phone is not null;
create unique index if not exists pin_credentials_phone_canonical on public.pin_credentials (public.canonical_phone(phone));

-- True when no account uses the number in any form. For pin-auth's sign-up (service role only); sign-up
-- already answers "taken" for an existing number, and sign-in and resets still never say whether a number
-- has an account.
create or replace function public.pin_phone_available(p_phone text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select not exists (select 1 from auth.users u where u.email like '%@pin.jareeye.app' and canonical_phone(split_part(u.email, '@', 1)) = canonical_phone(p_phone))
     and not exists (select 1 from auth.users u where coalesce(u.phone, '') <> '' and canonical_phone(u.phone) = canonical_phone(p_phone))
     and not exists (select 1 from profiles p where canonical_phone(p.phone) = canonical_phone(p_phone))
     and not exists (select 1 from pin_credentials c where canonical_phone(c.phone) = canonical_phone(p_phone));
$$;

-- Every admin phone correction: who, when, from and to.
create table if not exists public.phone_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  old_phone text,
  new_phone text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.phone_changes enable row level security;
drop policy if exists "admins read phone changes" on public.phone_changes;
create policy "admins read phone changes" on public.phone_changes for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.phone_changes from anon, authenticated;
revoke all on public.phone_changes from anon;

-- Corrects an account's number everywhere (login address, SMS phone, PIN credential, profile), keeping
-- the PIN, the Jareeye number and all history. Refused if any other account has the number. A rider must
-- confirm the new number again: their confirmation is cleared, an approved rider goes back to pending
-- (approval needs a confirmed number) and offline. The account is signed out so it picks up the change.
create or replace function public.admin_change_phone(p_user_id uuid, p_phone text)
returns table (old_phone text, new_phone text, rider_reset boolean)
language plpgsql security definer set search_path = public, auth as $$
declare
  v_new text := canonical_phone(p_phone);
  v_old text;
  v_reset boolean := false;
begin
  if not is_admin() then raise exception 'admins only'; end if;
  if v_new is null or v_new !~ '^252[1-9][0-9]{8}$' then raise exception 'invalid phone'; end if;

  -- Two corrections to the same number, or of the same account, wait for each other.
  perform pg_advisory_xact_lock(hashtextextended('phone:' || v_new, 0));
  perform pg_advisory_xact_lock(hashtextextended('phone-account:' || p_user_id::text, 0));

  select p.phone into v_old from profiles p where p.id = p_user_id for update;
  if not found then raise exception 'account not found'; end if;
  if canonical_phone(v_old) = v_new then raise exception 'same number'; end if;
  if exists (
    select 1 from auth.users u
    where u.id <> p_user_id and (
      (u.email like '%@pin.jareeye.app' and canonical_phone(split_part(u.email, '@', 1)) = v_new)
      or (coalesce(u.phone, '') <> '' and canonical_phone(u.phone) = v_new))
  ) or exists (select 1 from profiles p where p.id <> p_user_id and canonical_phone(p.phone) = v_new)
    or exists (select 1 from pin_credentials c where c.user_id <> p_user_id and canonical_phone(c.phone) = v_new) then
    raise exception 'phone taken';
  end if;

  update auth.users set email = v_new || '@pin.jareeye.app', updated_at = now()
  where id = p_user_id and email like '%@pin.jareeye.app';
  update auth.users set phone = v_new, updated_at = now() where id = p_user_id and coalesce(phone, '') <> '';
  -- Supabase keeps a copy of the login address in auth.identities (absent from the local test shim).
  if to_regclass('auth.identities') is not null then
    execute $q$update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb($1 || '@pin.jareeye.app')), updated_at = now()
              where user_id = $2 and provider = 'email' and identity_data->>'email' like '%@pin.jareeye.app'$q$ using v_new, p_user_id;
    execute $q$update auth.identities set identity_data = jsonb_set(identity_data, '{phone}', to_jsonb($1)), updated_at = now()
              where user_id = $2 and provider = 'phone'$q$ using v_new, p_user_id;
  end if;
  update pin_credentials set phone = v_new, updated_at = now() where user_id = p_user_id;
  update profiles set phone = v_new where id = p_user_id;

  -- Riders confirm the new number again before customers can call it.
  update rider_applications
  set phone_verified_by = null, phone_verified_at = null, phone_verified_number = null,
      status = case when status = 'approved' then 'pending'::application_status else status end
  where user_id = p_user_id;
  v_reset := found;
  if v_reset then
    update profiles set is_online = false, lat = null, lng = null, busy_until = null where id = p_user_id;
    delete from rider_phone_checks where user_id = p_user_id;
  end if;

  delete from auth.sessions where user_id = p_user_id;
  insert into phone_changes (user_id, old_phone, new_phone, changed_by) values (p_user_id, v_old, v_new, auth.uid());
  return query select v_old, v_new, v_reset;
end;
$$;

revoke execute on function
  public.phone_conflicts(),
  public.pin_phone_available(text),
  public.admin_change_phone(uuid, text)
from public, anon, authenticated;
grant execute on function public.admin_change_phone(uuid, text) to authenticated;
grant execute on function public.pin_phone_available(text), public.phone_conflicts() to service_role;
