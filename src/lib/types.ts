// Mirrors supabase/migrations. Regenerate with `npx supabase gen types typescript` once the project is linked.

export type UserRole = 'customer' | 'rider' | 'admin';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type OrderKind = 'store' | 'package';
export type OrderStatus = 'placed' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled';
export type PaymentMethod = 'evc' | 'zaad' | 'sahal' | 'cash';
export type StoreCategory = 'food' | 'cafe' | 'shop' | 'pharma';

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  district: string | null;
  is_online: boolean;
  created_at: string;
};

export type RiderApplication = {
  user_id: string;
  id_number: string;
  plate: string;
  district: string;
  id_photo_path: string | null;
  status: ApplicationStatus;
  reviewed_at: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  name: string;
  description: string;
  category: StoreCategory;
  district: string;
  eta_label: string;
  is_open: boolean;
};

export type Product = {
  id: string;
  store_id: string;
  name: string;
  description: string;
  price: number;
  is_available: boolean;
  sort_order: number;
};

export type Order = {
  id: number;
  kind: OrderKind;
  customer_id: string;
  rider_id: string | null;
  store_id: string | null;
  pickup_district: string;
  pickup_note: string;
  dropoff_district: string;
  dropoff_note: string;
  package_type: string | null;
  items_total: number;
  delivery_fee: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
};
