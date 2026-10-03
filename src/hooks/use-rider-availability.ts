import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { riderPosition } from '@/lib/location';
import { RiderAvailability, type AvailabilityStore } from '@/lib/rider-availability';
import { supabase } from '@/lib/supabase';

// While online, refresh the rider's position and "last seen" so people see who is really available.
const PING_MS = 30_000;
// "I'm on a delivery" hides the driver for this long, in case they forget to come back.
const BUSY_MINUTES = 45;

/** The rider's profile row in Supabase, written only through these four saves. */
function supabaseStore(riderId: string): AvailabilityStore {
  const profile = () => supabase.from('profiles');
  return {
    getPosition: riderPosition,
    async saveOnline(pos) {
      const { error } = await profile()
        .update({ is_online: true, lat: pos.lat, lng: pos.lng, last_seen_at: new Date().toISOString(), busy_until: null })
        .eq('id', riderId);
      if (error) throw error;
    },
    async saveOffline() {
      const { error } = await profile()
        .update({ is_online: false, lat: null, lng: null, busy_until: null })
        .eq('id', riderId);
      if (error) throw error;
    },
    async saveHeartbeat(pos) {
      // `is_online = true` in the filter: a late update can never turn an offline rider back on.
      const { data, error } = await profile()
        .update({ last_seen_at: new Date().toISOString(), ...(pos ? { lat: pos.lat, lng: pos.lng } : {}) })
        .eq('id', riderId)
        .eq('is_online', true)
        .select('id');
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    async saveBusy(until) {
      const { data, error } = await profile()
        .update({ busy_until: until })
        .eq('id', riderId)
        .eq('is_online', true)
        .select('id');
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  };
}

/**
 * Online / busy state for the rider screen. Changes show only after they are saved; while online,
 * the position is refreshed every 30 seconds and straight away when the app comes back to the front.
 * When the phone locks or the app goes to the background the updates pause, and after 10 minutes
 * customers stop seeing the rider until they come back.
 */
export function useRiderAvailability(riderId: string, initial: { online: boolean; busyUntil: string | null }) {
  const [controller] = useState(
    () => new RiderAvailability(supabaseStore(riderId), initial, { busyMinutes: BUSY_MINUTES }),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  // The clock is read in timers only, so rendering stays pure.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!state.online) return;
    const first = setTimeout(() => controller.heartbeat(), 0);
    const timer = setInterval(() => controller.heartbeat(), PING_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        setNow(Date.now());
        controller.heartbeat();
      }
    });
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      sub.remove();
    };
  }, [controller, state.online]);

  // Re-render when the busy time runs out, so the screen switches back to "online" by itself.
  const busy = state.online && state.busyUntil != null && new Date(state.busyUntil).getTime() > now;
  useEffect(() => {
    if (!state.busyUntil) return;
    const left = new Date(state.busyUntil).getTime() - Date.now();
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, left) + 500);
    return () => clearTimeout(timer);
  }, [state.busyUntil]);

  return { ...state, busy, controller };
}
