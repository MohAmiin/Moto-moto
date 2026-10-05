import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { BadgeTone } from '@/components/kit';
import type { TKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { Membership, MembershipPayment, MembershipSettings, MembershipStatus } from '@/lib/types';

// Rider memberships. The database decides everything with its own clock (membership_status_of); the app
// only shows it. See supabase/migrations/20261010000000_rider_membership.sql.

export const MEMBERSHIP_LOOK: Record<MembershipStatus, { label: TKey; tone: BadgeTone }> = {
  free: { label: 'mem.free', tone: 'neutral' },
  active: { label: 'mem.active', tone: 'success' },
  expiring: { label: 'mem.expiring', tone: 'warning' },
  expired: { label: 'mem.expired', tone: 'danger' },
  unpaid: { label: 'mem.unpaid', tone: 'danger' },
};

/** Expired or never paid: can't go online while the switch is on. */
export const needsPayment = (s: MembershipStatus | undefined) => s === 'expired' || s === 'unpaid';

export type MyMembership = Membership & { price_usd: number | null; instructions: string | null };

/** The signed-in rider's membership, refreshed on focus and every minute. undefined while loading, null if it failed. */
export function useMyMembership() {
  const [value, setValue] = useState<MyMembership | null>();
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_membership');
    const row = (data as MyMembership[] | null)?.[0];
    if (error || !row) setValue((prev) => (prev === undefined ? null : prev));
    else setValue(row);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 60_000);
      return () => clearInterval(timer);
    }, [load]),
  );
  return { membership: value, reload: load };
}

export async function fetchMembershipSettings() {
  const { data, error } = await supabase.from('membership_settings').select('required, price_usd, instructions, first_enabled_at, updated_at').maybeSingle();
  if (error) throw error;
  return data as MembershipSettings | null;
}

export async function saveMembershipSettings(required: boolean, priceUsd: number | null, instructions: string) {
  const { data, error } = await supabase.rpc('admin_set_membership_settings', { p_required: required, p_price_usd: priceUsd, p_instructions: instructions });
  if (error) throw error;
  return ((data as { is_required: boolean; grace_given: number }[] | null) ?? [])[0];
}

/** Every rider's membership by user id (admins only). */
export async function fetchMemberships() {
  const { data, error } = await supabase.rpc('admin_rider_memberships');
  if (error) throw error;
  return new Map(((data as (Membership & { user_id: string })[]) ?? []).map((m) => [m.user_id, m]));
}

export async function fetchMembershipHistory(userId: string) {
  const { data, error } = await supabase.rpc('admin_membership_history', { p_user_id: userId });
  if (error) throw error;
  return (data as MembershipPayment[]) ?? [];
}

export type ConfirmResult = { payment_id: string; period_start: string; period_end: string; duplicate: boolean };

export async function confirmMembershipPayment(userId: string, amountUsd: number, reference: string, requestId: string) {
  const { data, error } = await supabase.rpc('admin_confirm_membership_payment', {
    p_user_id: userId,
    p_amount_usd: amountUsd,
    p_reference: reference,
    p_request_id: requestId,
  });
  if (error) throw error;
  return ((data as ConfirmResult[] | null) ?? [])[0];
}

/**
 * A random id for one payment confirmation. Sent again on a retry, so the database records the payment
 * once (it is not a secret, only a de-duplication key).
 */
export function newRequestId() {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** "$10.00". */
export const usd = (n: number | string | null | undefined) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);

/** Parses an amount typed by an admin ("10", "10.5", "10,50"); null when it isn't a positive amount. */
export function parseUsd(text: string) {
  const v = Number(text.trim().replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 10_000 ? Math.round(v * 100) / 100 : null;
}
