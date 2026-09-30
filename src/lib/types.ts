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
  id_number: string;
  plate: string;
  district: string;
  id_photo_path: string | null;
  /** Jareeye number, given on first approval (shown as JRY-001). */
  rider_number: number | null;
  status: ApplicationStatus;
  reviewed_at: string | null;
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
  /** Average stars, or null before the first rating. */
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
