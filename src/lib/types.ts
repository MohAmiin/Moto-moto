// Mirrors supabase/migrations. Regenerate with `npx supabase gen types typescript` once the project is linked.

export type UserRole = 'customer' | 'rider' | 'admin';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  district: string | null;
  is_online: boolean;
  lat: number | null;
  lng: number | null;
  last_seen_at: string | null;
  /** Face photo in the public rider-photos bucket. */
  photo_path: string | null;
  /** While in the future, the driver is on a delivery and hidden from customers. */
  busy_until: string | null;
  created_at: string;
};

export type RiderApplication = {
  user_id: string;
  /** Optional during the pilot. */
  id_number: string | null;
  plate: string;
  district: string;
  id_photo_path: string | null;
  /** Jareeye number, given on first approval (shown as JRY-001). */
  rider_number: number | null;
  status: ApplicationStatus;
  reviewed_at: string | null;
  /** The admin who called the rider's number and confirmed it, when, and which number. */
  phone_verified_by: string | null;
  phone_verified_at: string | null;
  phone_verified_number: string | null;
  created_at: string;
};

/** A row from the nearby_riders() database function. */
export type NearbyRider = {
  id: string;
  full_name: string;
  phone: string | null;
  plate: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  last_seen_at: string;
  photo_path: string | null;
  rider_number: number | null;
  /** Average stars (one current rating per customer), or null before the first rating. */
  rating: number | null;
  rating_count: number;
  /** Only admins see busy drivers. */
  is_busy: boolean;
};

/** A row from call_to_rate(): the caller's latest call still waiting for a rating. */
export type CallToRate = {
  call_id: string;
  rider_id: string;
  full_name: string;
  photo_path: string | null;
  rider_number: number | null;
  called_at: string;
};

/** Rider membership (20261010000000_rider_membership.sql). `free` while the admin switch is off. */
export type MembershipStatus = 'free' | 'active' | 'expiring' | 'expired' | 'unpaid';

/** A row from my_membership() or admin_rider_memberships(). */
export type Membership = {
  status: MembershipStatus;
  expires_at: string | null;
  /** Whole days left, rounded up; null without a membership. */
  days_left: number | null;
};

export type MembershipSettings = {
  required: boolean;
  price_usd: number | null;
  instructions: string | null;
  first_enabled_at: string | null;
  updated_at: string;
};

/** A row from admin_membership_history(). */
export type MembershipPayment = {
  id: string;
  kind: 'payment' | 'grace';
  amount_usd: number;
  /** null for grace periods. */
  method: string | null;
  reference: string | null;
  received_into: string | null;
  confirmed_at: string;
  confirmed_by_name: string | null;
  previous_expires_at: string | null;
  period_start: string;
  period_end: string;
};

/** Request a moto (20261012000000_moto_requests.sql). */
export type RequestStatus = 'searching' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled' | 'expired';

/** One request as moto_request_detail() shows it to the customer, the assigned rider or an admin. */
export type MotoRequestDetail = {
  id: string;
  status: RequestStatus;
  wave: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_label: string | null;
  note: string | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  expires_at: string;
  rated_at: string | null;
  offered_count: number;
  wave1_count: number;
  wave2_count: number;
  rider_id: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  rider_photo_path: string | null;
  rider_number: number | null;
  rider_plate: string | null;
  rider_rating: number | null;
  rider_rating_count: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  rider_seen_at: string | null;
  /** Only for the rider and admins; the number only once accepted. */
  customer_name: string | null;
  customer_phone: string | null;
  can_rate: boolean;
};

/** A request offered to the signed-in rider (my_request_offers). No customer details before accepting. */
export type RequestOffer = {
  request_id: string;
  wave: number;
  distance_km: number;
  trip_km: number;
  pickup_label: string | null;
  dropoff_label: string | null;
  note: string | null;
  offered_at: string;
  expires_at: string;
  closed_at: string | null;
  outcome: 'won' | 'taken' | 'expired' | 'cancelled' | null;
};

export type AdminRequestRow = {
  id: string;
  status: RequestStatus;
  wave: number;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  customer_id: string;
  customer_name: string;
  rider_id: string | null;
  rider_name: string | null;
  rider_number: number | null;
  pickup_label: string | null;
  dropoff_label: string | null;
  offered_count: number;
};

export type RequestStats = {
  sent: number;
  accepted: number;
  delivered: number;
  expired: number;
  cancelled: number;
  open: number;
  avg_accept_seconds: number | null;
};

export type RequestSettings = {
  first_radius_km: number;
  second_radius_km: number;
  riders_per_wave: number;
  wave_seconds: number;
  expire_seconds: number;
};
