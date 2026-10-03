-- A minimal stand-in for the parts of Supabase the migrations use, so they can be applied and tested on a
-- plain local Postgres (scripts/test-db.sh). Never run this against a Supabase project.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;
create extension pgcrypto with schema extensions;

-- auth -----------------------------------------------------------------------------------------------
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text unique,
  encrypted_password text,
  email_confirmed_at timestamptz default now(),
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users (id) on delete cascade);
create table auth.refresh_tokens (id bigserial primary key, user_id uuid references auth.users (id) on delete cascade, revoked boolean default false);

-- Tests act as a user with: select set_config('request.jwt.claim.sub', '<uuid>', false); set role authenticated;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- storage --------------------------------------------------------------------------------------------
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- realtime -------------------------------------------------------------------------------------------
create publication supabase_realtime;

-- Supabase grants table access to the API roles; RLS then decides row by row.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- Like Supabase, new functions are callable by the API roles unless a migration revokes that.
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
