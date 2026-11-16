import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { TKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { AdminRequestRow, MotoRequestDetail, RequestOffer, RequestSettings, RequestStats, RequestStatus } from '@/lib/types';

/** Statuses where something is still happening. */
export const OPEN_STATUSES: readonly RequestStatus[] = ['searching', 'accepted', 'picked_up'];
export const isOpen = (s: RequestStatus | undefined | null) => !!s && OPEN_STATUSES.includes(s);

/** Straight-line distance in km. */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** "350 m" or "2.4 km". */
export function shortKm(km: number | null | undefined) {
  if (km == null) return null;
  return km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(1)} km`;
}

/** "1:05" for a number of seconds (never negative). */
export function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Messages from the database, mapped to what we tell people.
const ERRORS: [string, TKey][] = [
  ['already have an open request', 'rq.errOpen'],
  ['outside the service area', 'rq.errOutside'],
  ['drop-off is missing', 'rq.errDropoff'],
  ['note is too long', 'rq.errNote'],
  ['too many requests', 'rq.errTooMany'],
  ['already picked it up', 'rq.errPickedUp'],
  ['already closed', 'rq.errClosed'],
];
export function requestErrorKey(error: unknown): TKey {
  const message = String((error as { message?: string } | null)?.message ?? '');
  return ERRORS.find(([needle]) => message.includes(needle))?.[1] ?? 'rq.errFailed';
}

/** Re-renders every `ms` (for countdowns). */
export function useTicker(ms: number, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms, active]);
  return now;
}

/**
 * Runs `load` now, whenever a change arrives on the realtime channel, every `pollMs` while the app is in
 * front (a fallback, and the rider's position comes from their profile), and when the app comes back.
 */
function useLive(load: () => void, channel: string | null, subscribe: ((c: ReturnType<typeof supabase.channel>) => void) | null, pollMs: number) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!channel) return;
    const first = setTimeout(() => loadRef.current(), 0);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') loadRef.current();
    }, pollMs);
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') loadRef.current();
    });
    const ch = supabase.channel(channel);
    subscribe?.(ch);
    ch.subscribe();
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      appState.remove();
      supabase.removeChannel(ch);
    };
    // `subscribe` is defined inline by callers; the channel name carries everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, pollMs]);
}

/** One request, kept live. `request` is undefined while loading and null if it can't be read. */
export function useMotoRequest(id: string | null | undefined) {
  const [request, setRequest] = useState<MotoRequestDetail | null>();
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.rpc('moto_request_detail', { p_request_id: id });
    if (error) {
      // "not found" is final; anything else is a connection problem and the last answer stays.
      if (String(error.message).includes('not found')) setRequest(null);
      else setFailed(true);
      return;
    }
    setFailed(false);
    setRequest(((data as MotoRequestDetail[] | null) ?? [])[0] ?? null);
  }, [id]);

  useLive(
    load,
    id ? `moto-request-${id}` : null,
    (ch) => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'moto_requests', filter: `id=eq.${id}` }, () => load()),
    5_000,
  );
  return { request, failed, reload: load };
}

/** The customer's open request, or a delivered one waiting for a rating; re-checked when the screen shows. */
export function useMyMotoRequest() {
  const [id, setId] = useState<string | null>();
  const [status, setStatus] = useState<RequestStatus | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_moto_request');
    if (error) return;
    const next = (data as string | null) ?? null;
    setId(next);
    if (!next) {
      setStatus(null);
      return;
    }
    const detail = await supabase.rpc('moto_request_detail', { p_request_id: next });
    setStatus(((detail.data as MotoRequestDetail[] | null) ?? [])[0]?.status ?? null);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 15_000);
      return () => clearInterval(timer);
    }, [load]),
  );
  return { id, status, reload: load };
}

/** Requests offered to this rider, kept live. */
export function useRiderOffers(riderId: string) {
  const [offers, setOffers] = useState<RequestOffer[]>([]);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_request_offers');
    if (!error) setOffers((data as RequestOffer[] | null) ?? []);
  }, []);
  useLive(
    load,
    `request-offers-${riderId}`,
    (ch) => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'request_offers', filter: `rider_id=eq.${riderId}` }, () => load()),
    5_000,
  );
  return { offers, reload: load };
}

/** The rider's current job id (accepted or picked up), kept live. */
export function useActiveJob(riderId: string) {
  const [jobId, setJobId] = useState<string | null>();
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_active_job');
    if (!error) setJobId((data as string | null) ?? null);
  }, []);
  useLive(
    load,
    `active-job-${riderId}`,
    (ch) => ch.on('postgres_changes', { event: '*', schema: 'public', table: 'moto_requests', filter: `rider_id=eq.${riderId}` }, () => load()),
    10_000,
  );
  return { jobId, reload: load };
}

export async function createMotoRequest(input: {
  pickup: { lat: number; lng: number };
  pickupLabel: string;
  dropoff: { lat: number; lng: number };
  dropoffLabel: string;
  note: string;
}) {
  const { data, error } = await supabase.rpc('create_moto_request', {
    p_pickup_lat: input.pickup.lat,
    p_pickup_lng: input.pickup.lng,
    p_pickup_label: input.pickupLabel,
    p_dropoff_lat: input.dropoff.lat,
    p_dropoff_lng: input.dropoff.lng,
    p_dropoff_label: input.dropoffLabel,
    p_note: input.note,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelMotoRequest(id: string) {
  const { error } = await supabase.rpc('cancel_moto_request', { p_request_id: id });
  if (error) throw error;
}

/** 'ok', or why not: 'taken', 'closed', 'busy'. */
export async function acceptMotoRequest(id: string) {
  const { data, error } = await supabase.rpc('accept_moto_request', { p_request_id: id });
  if (error) throw error;
  return data as 'ok' | 'taken' | 'closed' | 'busy';
}

export async function skipMotoRequest(id: string) {
  const { error } = await supabase.rpc('skip_moto_request', { p_request_id: id });
  if (error) throw error;
}

export async function setRequestStatus(id: string, status: 'picked_up' | 'delivered') {
  const { error } = await supabase.rpc('update_request_status', { p_request_id: id, p_status: status });
  if (error) throw error;
}

export async function rateMotoRequest(id: string, stars: number | null) {
  const { error } = await supabase.rpc('rate_request', { p_request_id: id, p_stars: stars });
  if (error) throw error;
}

export async function fetchAdminRequests(limit = 100) {
  const { data, error } = await supabase.rpc('admin_requests', { p_limit: limit });
  if (error) throw error;
  return (data as AdminRequestRow[] | null) ?? [];
}

export async function fetchRequestStats(since: Date) {
  const { data, error } = await supabase.rpc('admin_request_stats', { p_since: since.toISOString() });
  if (error) throw error;
  return ((data as RequestStats[] | null) ?? [])[0] ?? null;
}

export async function fetchRequestSettings() {
  const { data, error } = await supabase
    .from('request_settings')
    .select('first_radius_km, second_radius_km, riders_per_wave, wave_seconds, expire_seconds')
    .maybeSingle<RequestSettings>();
  if (error) throw error;
  return data;
}

export async function saveRequestSettings(s: RequestSettings) {
  const { error } = await supabase.rpc('admin_set_request_settings', {
    p_first_radius_km: s.first_radius_km,
    p_second_radius_km: s.second_radius_km,
    p_riders_per_wave: s.riders_per_wave,
    p_wave_seconds: s.wave_seconds,
    p_expire_seconds: s.expire_seconds,
  });
  if (error) throw error;
}
