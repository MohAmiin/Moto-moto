-- Dhaqso: initial schema
-- Customers order from stores or send packages; approved motorbike riders deliver for a flat fee.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'rider', 'admin');
create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.order_kind as enum ('store', 'package');
create type public.order_status as enum ('placed', 'accepted', 'picked_up', 'delivered', 'cancelled');
create type public.payment_method as enum ('evc', 'zaad', 'sahal', 'cash');
create type public.store_category as enum ('food', 'cafe', 'shop', 'pharma');

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id boolean primary key default true check (id),
  delivery_fee numeric(10, 2) not null default 1.00
);
insert into public.settings default values;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text,
  district text,
  is_online boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.rider_applications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  id_number text not null check (char_length(id_number) between 3 and 40),
  plate text not null check (char_length(plate) between 2 and 20),
  district text not null,
  id_photo_path text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Stores and products
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category public.store_category not null,
  district text not null,
  eta_label text not null default '20–30',
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0
);
create index products_store_idx on public.products (store_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id bigint generated always as identity (start with 1001) primary key,
  kind public.order_kind not null,
  customer_id uuid not null references public.profiles (id),
  rider_id uuid references public.profiles (id),
  store_id uuid references public.stores (id),
  pickup_district text not null,
  pickup_note text not null default '',
  dropoff_district text not null,
  dropoff_note text not null default '',
  package_type text,
  items_total numeric(10, 2) not null default 0,
  delivery_fee numeric(10, 2) not null,
  payment_method public.payment_method not null,
  status public.order_status not null default 'placed',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  check ((kind = 'store') = (store_id is not null))
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_rider_idx on public.orders (rider_id, created_at desc);
create index orders_open_idx on public.orders (status) where rider_id is null;

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  unit_price numeric(10, 2) not null,
  quantity int not null check (quantity between 1 and 50)
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_approved_rider()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join rider_applications a on a.user_id = p.id
    where p.id = auth.uid() and p.role = 'rider' and a.status = 'approved'
  );
$$;

-- Users may not change their own role; only admins (or the SQL editor, where auth.uid() is null) can.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'role cannot be changed';
  end if;
  return new;
end;
$$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.rider_applications enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "settings readable" on public.settings for select to authenticated using (true);

create policy "read own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or is_admin());
-- Customers see their rider, riders see their customer.
create policy "read order counterpart" on public.profiles for select to authenticated
  using (exists (
    select 1 from orders o
    where (o.customer_id = auth.uid() and o.rider_id = profiles.id)
       or (o.rider_id = auth.uid() and o.customer_id = profiles.id)
  ));
create policy "create own profile" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role in ('customer', 'rider'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "read own application" on public.rider_applications for select to authenticated
  using (user_id = auth.uid() or is_admin());
-- Customers can see the plate of the rider delivering their order.
create policy "read rider of my order" on public.rider_applications for select to authenticated
  using (exists (select 1 from orders o where o.customer_id = auth.uid() and o.rider_id = rider_applications.user_id));
create policy "submit own application" on public.rider_applications for insert to authenticated
  with check (
    user_id = auth.uid() and status = 'pending' and reviewed_by is null
    and exists (select 1 from profiles where id = auth.uid() and role = 'rider')
  );
-- A rejected rider may resubmit (which resets to pending).
create policy "resubmit own application" on public.rider_applications for update to authenticated
  using (user_id = auth.uid() and status = 'rejected')
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);

create policy "stores readable" on public.stores for select to authenticated using (true);
create policy "admins manage stores" on public.stores for all to authenticated using (is_admin()) with check (is_admin());
create policy "products readable" on public.products for select to authenticated using (true);
create policy "admins manage products" on public.products for all to authenticated using (is_admin()) with check (is_admin());

create policy "read my orders" on public.orders for select to authenticated
  using (customer_id = auth.uid() or rider_id = auth.uid() or is_admin());
create policy "riders see open jobs" on public.orders for select to authenticated
  using (rider_id is null and status = 'placed' and is_approved_rider());

create policy "read items of visible orders" on public.order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_items.order_id));

-- Orders and order items are written only through the functions below.

-- ---------------------------------------------------------------------------
-- Order functions
-- ---------------------------------------------------------------------------

-- items: [{ "product_id": uuid, "quantity": int }, ...]. Prices come from the database.
create or replace function public.place_store_order(
  p_store_id uuid, p_items jsonb, p_dropoff_district text, p_dropoff_note text, p_payment public.payment_method
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_store stores;
  v_order_id bigint;
  v_total numeric(10, 2) := 0;
  v_item jsonb;
  v_product products;
  v_qty int;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'customer') then
    raise exception 'only customers can place orders';
  end if;
  select * into v_store from stores where id = p_store_id and is_open;
  if not found then raise exception 'store is closed or missing'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'order is empty'; end if;

  insert into orders (kind, customer_id, store_id, pickup_district, pickup_note, dropoff_district, dropoff_note, delivery_fee, payment_method)
  values ('store', auth.uid(), v_store.id, v_store.district, v_store.name, p_dropoff_district, coalesce(p_dropoff_note, ''),
          (select delivery_fee from settings), p_payment)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    select * into v_product from products
      where id = (v_item ->> 'product_id')::uuid and store_id = v_store.id and is_available;
    if not found then raise exception 'product unavailable'; end if;
    insert into order_items (order_id, product_id, name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty);
    v_total := v_total + v_product.price * v_qty;
  end loop;

  update orders set items_total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

create or replace function public.place_package_order(
  p_pickup_district text, p_pickup_note text, p_dropoff_district text, p_dropoff_note text,
  p_package_type text, p_payment public.payment_method
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_order_id bigint;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'customer') then
    raise exception 'only customers can place orders';
  end if;
  insert into orders (kind, customer_id, pickup_district, pickup_note, dropoff_district, dropoff_note, package_type, delivery_fee, payment_method)
  values ('package', auth.uid(), p_pickup_district, coalesce(p_pickup_note, ''), p_dropoff_district, coalesce(p_dropoff_note, ''),
          p_package_type, (select delivery_fee from settings), p_payment)
  returning id into v_order_id;
  return v_order_id;
end;
$$;

create or replace function public.cancel_order(p_order_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'cancelled'
  where id = p_order_id and customer_id = auth.uid() and status = 'placed' and rider_id is null;
  if not found then raise exception 'order can no longer be cancelled'; end if;
end;
$$;

-- First rider to accept wins; a rider can hold one active job at a time.
create or replace function public.accept_order(p_order_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_approved_rider() then raise exception 'rider is not approved'; end if;
  if exists (select 1 from orders where rider_id = auth.uid() and status in ('accepted', 'picked_up')) then
    raise exception 'finish your current job first';
  end if;
  update orders set rider_id = auth.uid(), status = 'accepted', accepted_at = now()
  where id = p_order_id and rider_id is null and status = 'placed';
  if not found then raise exception 'order was taken by another rider'; end if;
end;
$$;

create or replace function public.advance_order(p_order_id bigint)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare v_status order_status;
begin
  update orders set
    status = case status when 'accepted' then 'picked_up'::order_status else 'delivered'::order_status end,
    picked_up_at = case when status = 'accepted' then now() else picked_up_at end,
    delivered_at = case when status = 'picked_up' then now() else delivered_at end
  where id = p_order_id and rider_id = auth.uid() and status in ('accepted', 'picked_up')
  returning status into v_status;
  if not found then raise exception 'job is not active'; end if;
  return v_status;
end;
$$;

create or replace function public.review_rider(p_user_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins only'; end if;
  update rider_applications
  set status = case when p_approve then 'approved'::application_status else 'rejected'::application_status end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where user_id = p_user_id;
  if not found then raise exception 'application not found'; end if;
end;
$$;

revoke execute on function public.place_store_order, public.place_package_order, public.cancel_order,
  public.accept_order, public.advance_order, public.review_rider from public, anon;
grant execute on function public.place_store_order, public.place_package_order, public.cancel_order,
  public.accept_order, public.advance_order, public.review_rider to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: apps listen for order changes
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.rider_applications;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for rider ID photos, one folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('rider-ids', 'rider-ids', false)
on conflict (id) do nothing;

create policy "riders upload own id photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'rider-ids' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "riders replace own id photo" on storage.objects for update to authenticated
  using (bucket_id = 'rider-ids' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner or admin reads id photo" on storage.objects for select to authenticated
  using (bucket_id = 'rider-ids' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
