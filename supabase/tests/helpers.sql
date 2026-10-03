-- Loaded before every *.test.sql file (inside its rolled-back transaction).
set search_path = public, extensions;

-- A phone-login account with a profile, like one made by the old app (4-digit PIN as the password).
create function pg_temp.new_user(p_phone text, p_role text, p_pin text default '1234') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into auth.users (email, encrypted_password)
  values (p_phone || '@pin.jareeye.app', crypt('jareeye-pin-' || p_pin, gen_salt('bf', 4)))
  returning id into v_id;
  insert into public.profiles (id, role, full_name, phone)
  values (v_id, p_role::public.user_role, 'Test ' || p_role, p_phone);
  return v_id;
end;
$$;

-- An approved rider (approved directly, as riders approved before phone checks were).
create function pg_temp.new_rider(p_phone text) returns uuid language plpgsql as $$
declare v_id uuid := pg_temp.new_user(p_phone, 'rider');
begin
  insert into public.rider_applications (user_id, plate, district, status) values (v_id, 'AB123', 'Koodbuur', 'approved');
  return v_id;
end;
$$;

-- Act as a signed-in user (or anon / service_role when p_uid is null), like PostgREST does.
create function pg_temp.act_as(p_uid uuid, p_role text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('role', p_role, true);
end;
$$;

create function pg_temp.act_as_owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', '', true);
end;
$$;

create function pg_temp.eq(p_actual anyelement, p_expected anyelement, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED: % (expected %, got %)', p_label, p_expected, p_actual;
  end if;
end;
$$;

-- Runs p_sql and checks it fails with an error message containing p_pattern.
create function pg_temp.throws(p_sql text, p_pattern text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_pattern in sqlerrm) = 0 then
      raise exception 'FAILED: % (expected error containing "%", got "%")', p_label, p_pattern, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAILED: % (expected an error containing "%", but it succeeded)', p_label, p_pattern;
end;
$$;
