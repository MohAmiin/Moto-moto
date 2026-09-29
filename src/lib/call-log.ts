import { supabase } from '@/lib/supabase';

/** Phones are stored as digits with the country code, e.g. 252634740002. */
export const telUrl = (phone: string) => `tel:+${phone.replace(/\D/g, '')}`;

/** Records the call so usage can be counted; never holds up the call itself. */
export function logCall(riderId: string) {
  supabase
    .rpc('log_call', { p_rider_id: riderId })
    .then(({ error }) => {
      if (error) console.warn('log_call failed', error.message);
    });
}
