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
};
