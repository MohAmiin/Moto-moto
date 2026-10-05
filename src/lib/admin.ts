import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { BadgeTone } from '@/components/kit';
import type { TKey } from '@/lib/i18n';
import type { MembershipStatus, NearbyRider, Profile, RiderApplication } from '@/lib/types';

// Data for the admin screens. Everything here is read with the admin's own session, so row-level
// security (is_admin()) and the admin-only database functions decide what comes back.

export type Application = RiderApplication & {
  profile: { full_name: string; phone: string | null; photo_path: string | null; created_at: string } | null;
};

/** A row from admin_pin_reset_requests(). */
export type PinReset = {
  id: string;
  phone: string;
  created_at: string;
  expires_at: string;
  checks_left: number;
  open_for_number: number;
  full_name: string | null;
  role: string | null;
  photo_path: string | null;
  rider_number: number | null;
};

/** What happened after a code was typed in. */
export type CodeResult = { outcome: string; checks_left: number };

export type CustomerRow = Pick<Profile, 'id' | 'full_name' | 'phone' | 'district' | 'created_at'>;

const APPLICATION_SELECT = '*, profile:profiles!rider_applications_user_id_fkey(full_name, phone, photo_path, created_at)';

export async function fetchApplications() {
  const { data, error } = await supabase.from('rider_applications').select(APPLICATION_SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Application[]) ?? [];
}

export async function fetchApplication(userId: string) {
  const { data, error } = await supabase.from('rider_applications').select(APPLICATION_SELECT).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as Application | null) ?? null;
}

/** A rider reporting online (approved, fresh location), with whether customers can find them and why not. */
export type OnlineRider = NearbyRider & { available: boolean; membership_status: MembershipStatus };

/**
 * Riders reporting online, for admins: busy riders and riders hidden for membership included, each
 * labelled (admin_online_riders). Customers only ever get the available ones (nearby_riders).
 */
export async function fetchOnlineRiders(): Promise<OnlineRider[]> {
  const { data, error } = await supabase.rpc('admin_online_riders');
  if (!error) return (data as OnlineRider[]) ?? [];
  // Before 20261010000000_rider_membership.sql is applied there is no membership: use the older function.
  if (error.code === 'PGRST202' || /admin_online_riders/.test(error.message)) {
    const old = await supabase.rpc('nearby_riders', { p_lat: null, p_lng: null, p_area: null });
    if (old.error) throw old.error;
    return ((old.data as NearbyRider[]) ?? []).map((r) => ({ ...r, available: !r.is_busy, membership_status: 'free' as const }));
  }
  throw error;
}

/** "Available to customers", "Busy", or reporting online but hidden for membership. */
export function onlineLabel(r: OnlineRider): { label: TKey; tone: BadgeTone } {
  if (r.available) return { label: 'adm.availableToCustomers', tone: 'success' };
  if (r.is_busy) return { label: 'adm.busy', tone: 'primary' };
  return { label: 'adm.hiddenMembership', tone: 'danger' };
}

export async function fetchPinResets() {
  const { data, error } = await supabase.rpc('admin_pin_reset_requests');
  if (error) throw error;
  return (data as PinReset[]) ?? [];
}

/** A rider's application counts as phone-checked for their current number. Mirrors review_rider. */
export function phoneConfirmed(a: Application) {
  return a.phone_verified_at != null && a.profile?.phone != null && a.phone_verified_number === a.profile.phone;
}

/** Midnight today on this phone, for "today" figures. */
export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** "14:05" for today, otherwise a short date. */
export function shortTime(iso: string, locale: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** Lower-case digits and letters only, so "JRY-007", "jry 7" and "007" can match. */
export function searchKey(s: string | null | undefined) {
  return (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** True when the rider's number matches a search such as "7", "007", "jry7" or "JRY-007". */
export function matchesRiderNumber(n: number | null, query: string) {
  if (n == null) return false;
  const q = searchKey(query).replace(/^jry/, '');
  if (!/^\d+$/.test(q)) return false;
  return Number(q) === n;
}

/**
 * Loads while the screen is in view: on focus, every 30 seconds, and when rider applications change.
 * Stops when the admin moves to another tab. `load` must be stable (useCallback).
 */
export function useAdminRefresh(load: () => unknown, channelName: string) {
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 30_000);
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_applications' }, () => load())
        .subscribe();
      return () => {
        clearInterval(timer);
        supabase.removeChannel(channel);
      };
    }, [load, channelName]),
  );
}

/** Pull-to-refresh state that only shows the spinner for a pull, not for background refreshes. */
export function usePullToRefresh(load: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);
  return { refreshing, onRefresh };
}
