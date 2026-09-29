-- Call log: one row each time someone taps Call on a rider. Calls are free; the log shows how much each
-- rider is used. Safe to run more than once.

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists calls_rider_created on public.calls (rider_id, created_at desc);
create index if not exists calls_caller_created on public.calls (caller_id, created_at desc);

alter table public.calls enable row level security;

drop policy if exists "read own calls" on public.calls;
create policy "read own calls" on public.calls for select to authenticated
  using (caller_id = auth.uid() or rider_id = auth.uid() or public.is_admin());

-- Rows are only added through log_call(), which checks the rider is a real approved rider.
create or replace function public.log_call(p_rider_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from rider_applications where user_id = p_rider_id and status = 'approved'
  ) then raise exception 'rider is not approved'; end if;
  insert into calls (caller_id, rider_id) values (auth.uid(), p_rider_id);
end;
$$;

revoke execute on function public.log_call(uuid) from public, anon;
grant execute on function public.log_call(uuid) to authenticated;
