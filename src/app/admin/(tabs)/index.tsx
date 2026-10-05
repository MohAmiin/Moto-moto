import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import {
  AdminIcon,
  AdminScreen,
  EmptyNote,
  ListRow,
  Panel,
  SectionTitle,
  StatCard,
  TopBar,
  type AdminIconName,
  type Metric,
} from '@/components/kit';
import { ConnectionBanner } from '@/components/connection-banner';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  fetchApplications,
  fetchOnlineRiders,
  fetchPinResets,
  shortTime,
  startOfToday,
  useAdminRefresh,
  usePullToRefresh,
  type Application,
  type PinReset,
} from '@/lib/admin';
import { formatPhone } from '@/lib/format';
import { fetchMembershipSettings, fetchMemberships, needsPayment } from '@/lib/membership';
import { useI18n, type TKey } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { NearbyRider } from '@/lib/types';

/** Something that happened, taken from existing records (no invented events). */
type Activity = {
  key: string;
  at: string;
  kind: 'customerJoined' | 'applied' | 'approved' | 'rejected' | 'call' | 'reset';
  name: string;
  other?: string;
  riderId?: string;
};

const ACTIVITY: Record<Activity['kind'], { icon: AdminIconName; text: TKey }> = {
  customerJoined: { icon: 'personAdd', text: 'adm.actCustomerJoined' },
  applied: { icon: 'document', text: 'adm.actApplied' },
  approved: { icon: 'check', text: 'adm.actApproved' },
  rejected: { icon: 'cross', text: 'adm.actRejected' },
  call: { icon: 'phone', text: 'adm.actCall' },
  reset: { icon: 'key', text: 'adm.actReset' },
};

type CountResult = { count: number | null; error: unknown };

async function count(query: PromiseLike<CountResult>) {
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
}

async function fetchRecentCalls() {
  const { data, error } = await supabase.from('calls').select('id, created_at, caller_id, rider_id').order('created_at', { ascending: false }).limit(8);
  if (error) throw error;
  const calls = (data as { id: string; created_at: string; caller_id: string; rider_id: string }[]) ?? [];
  const ids = [...new Set(calls.flatMap((c) => [c.caller_id, c.rider_id]))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people, error: e } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    if (e) throw e;
    for (const p of (people as { id: string; full_name: string }[]) ?? []) names.set(p.id, p.full_name);
  }
  return calls.map((c) => ({ ...c, caller: names.get(c.caller_id) ?? '—', rider: names.get(c.rider_id) ?? '—' }));
}

async function fetchNewCustomers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data as { id: string; full_name: string; created_at: string }[]) ?? [];
}

function buildActivity(
  apps: Application[],
  calls: Awaited<ReturnType<typeof fetchRecentCalls>>,
  customers: Awaited<ReturnType<typeof fetchNewCustomers>>,
  resets: PinReset[],
): Activity[] {
  const items: Activity[] = [];
  for (const a of apps) {
    const name = a.profile?.full_name ?? '—';
    items.push({ key: `applied-${a.user_id}`, at: a.created_at, kind: 'applied', name, riderId: a.user_id });
    if (a.reviewed_at && a.status !== 'pending') {
      items.push({ key: `reviewed-${a.user_id}`, at: a.reviewed_at, kind: a.status === 'approved' ? 'approved' : 'rejected', name, riderId: a.user_id });
    }
  }
  for (const c of calls) items.push({ key: `call-${c.id}`, at: c.created_at, kind: 'call', name: c.caller, other: c.rider, riderId: c.rider_id });
  for (const p of customers) items.push({ key: `customer-${p.id}`, at: p.created_at, kind: 'customerJoined', name: p.full_name });
  for (const r of resets) items.push({ key: `reset-${r.id}`, at: r.created_at, kind: 'reset', name: r.full_name ?? formatPhone(r.phone) });
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

export default function Overview() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  // undefined while loading, null when that request failed, otherwise the real figure (which may be 0).
  const [online, setOnline] = useState<NearbyRider[] | null>();
  const [apps, setApps] = useState<Application[] | null>();
  const [resets, setResets] = useState<PinReset[] | null>();
  const [customers, setCustomers] = useState<Metric>();
  const [callsToday, setCallsToday] = useState<Metric>();
  const [activity, setActivity] = useState<Activity[] | null>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Riders whose membership needs renewing (expiring, expired or unpaid); null while paid membership is off.
  const [renew, setRenew] = useState<{ user_id: string; due: boolean }[] | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [r, a, p, c, k, calls, newCustomers] = await Promise.allSettled([
      fetchOnlineRiders(),
      fetchApplications(),
      fetchPinResets(),
      count(supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer')),
      count(supabase.from('calls').select('id', { count: 'exact', head: true }).gte('created_at', startOfToday())),
      fetchRecentCalls(),
      fetchNewCustomers(),
    ]);
    // Memberships are an extra: a failure here leaves the rest of the overview alone.
    Promise.all([fetchMembershipSettings(), fetchMemberships()])
      .then(([settings, all]) =>
        setRenew(settings?.required ? [...all.entries()].filter(([, m]) => m.status === 'expiring' || needsPayment(m.status)).map(([user_id, m]) => ({ user_id, due: needsPayment(m.status) })) : null),
      )
      .catch(() => {});
    // A failed refresh keeps what was already on screen; a figure that never loaded shows as failed.
    const keep = <T,>(res: PromiseSettledResult<T>, set: (fn: (prev: T | null | undefined) => T | null | undefined) => void) =>
      set((prev) => (res.status === 'fulfilled' ? res.value : prev === undefined ? null : prev));
    keep(r, setOnline);
    keep(a, setApps);
    keep(p, setResets);
    keep(c, setCustomers);
    keep(k, setCallsToday);
    if (a.status === 'fulfilled' && calls.status === 'fulfilled' && newCustomers.status === 'fulfilled' && p.status === 'fulfilled') {
      setActivity(buildActivity(a.value, calls.value, newCustomers.value, p.value));
    } else {
      setActivity((prev) => (prev === undefined ? null : prev));
    }
    setFailed([r, a, p, c, k, calls, newCustomers].some((x) => x.status === 'rejected'));
    setRefreshing(false);
  }, []);

  useAdminRefresh(load, 'admin-overview');
  const pull = usePullToRefresh(load);

  const available: Metric = online === undefined ? undefined : online === null ? null : online.filter((x) => !x.is_busy).length;
  const busy: Metric = online === undefined ? undefined : online === null ? null : online.filter((x) => x.is_busy).length;
  const pendingApps = apps?.filter((x) => x.status === 'pending') ?? [];
  const pending: Metric = apps === undefined ? undefined : apps === null ? null : pendingApps.length;
  const resetCount: Metric = resets === undefined ? undefined : resets === null ? null : resets.length;
  // Only approved riders need a membership.
  const approved = new Set((apps ?? []).filter((x) => x.status === 'approved').map((x) => x.user_id));
  const renewList = renew?.filter((m) => approved.has(m.user_id)) ?? null;
  const renewCount = renewList ? renewList.length : 0;
  const mapData = useMemo<LiveMapData>(() => ({ me: null, riders: riderPoints(online ?? [], t) }), [online, t]);

  const names = (list: (string | null | undefined)[]) => {
    const shown = list.filter(Boolean).slice(0, 2).join(', ');
    return list.length > 2 ? t('adm.andMore', { names: shown, n: list.length - 2 }) : shown;
  };

  return (
    <AdminScreen
      header={<TopBar title={t('adm.overview')} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.textSecondary} />}>
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}

      <View style={styles.grid}>
        <StatCard icon="riders" label={t('adm.statAvailable')} value={available} tone="success" onPress={() => router.navigate({ pathname: '/admin/riders', params: { filter: 'online' } })} />
        <StatCard icon="clock" label={t('adm.statBusy')} value={busy} tone="primary" onPress={() => router.push('/admin/map')} />
        <StatCard icon="document" label={t('adm.statPending')} value={pending} tone={pending ? 'accent' : 'neutral'} onPress={() => router.navigate({ pathname: '/admin/riders', params: { filter: 'pending' } })} />
        <StatCard icon="customers" label={t('adm.statCustomers')} value={customers} tone="neutral" onPress={() => router.navigate('/admin/customers')} />
      </View>
      <View style={[styles.secondary, { borderColor: theme.hairline, backgroundColor: theme.surface }]}>
        <AdminIcon name="phone" size={16} color={theme.textSecondary} />
        <Txt variant="muted" style={styles.secondaryLabel}>
          {t('adm.callsToday')}
        </Txt>
        <Txt style={styles.secondaryValue}>{callsToday === undefined ? '…' : callsToday === null ? t('adm.failedShort') : callsToday}</Txt>
      </View>

      <SectionTitle title={t('adm.attention')} />
      <Panel padded={false}>
        {pending === undefined || resetCount === undefined ? (
          <View style={styles.padded}>
            <EmptyNote icon="clock" title={t('common.loading')} />
          </View>
        ) : pending === 0 && resetCount === 0 && renewCount === 0 ? (
          <View style={styles.padded}>
            <EmptyNote icon="check" title={t('adm.allClear')} body={t('adm.allClearBody')} />
          </View>
        ) : (
          <>
            <ListRow
              leading={<CountDot value={pending} />}
              title={t('adm.pendingApprovals')}
              subtitle={pending === null ? t('adm.failedShort') : pending ? names(pendingApps.map((x) => x.profile?.full_name)) : t('adm.noneWaiting')}
              onPress={() => router.navigate({ pathname: '/admin/riders', params: { filter: 'pending' } })}
            />
            <ListRow
              leading={<CountDot value={resetCount} />}
              title={t('adm.pinResets')}
              subtitle={
                resetCount === null ? t('adm.failedShort') : resetCount ? names((resets ?? []).map((x) => x.full_name ?? formatPhone(x.phone))) : t('adm.noneWaiting')
              }
              onPress={() => router.push('/admin/resets')}
              last={!renewList}
            />
            {renewList ? (
              <ListRow
                leading={<CountDot value={renewCount} />}
                title={t('mem.toRenew')}
                subtitle={
                  renewCount
                    ? names(renewList.map((m) => (apps ?? []).find((x) => x.user_id === m.user_id)?.profile?.full_name))
                    : t('adm.noneWaiting')
                }
                onPress={() => router.navigate({ pathname: '/admin/riders', params: { filter: renewList.some((m) => m.due) ? 'renew' : 'expiring' } })}
                last
              />
            ) : null}
          </>
        )}
      </Panel>

      <SectionTitle title={t('adm.ridersOnMap')} action={{ label: t('adm.openMap'), onPress: () => router.push('/admin/map') }} />
      <Panel padded={false}>
        {online === undefined ? (
          <View style={styles.padded}>
            <EmptyNote icon="map" title={t('common.loading')} />
          </View>
        ) : online === null ? (
          <View style={styles.padded}>
            <EmptyNote icon="attention" title={t('adm.failedShort')} body={t('admin.loadFailed')} />
          </View>
        ) : online.length === 0 ? (
          <View style={styles.padded}>
            <EmptyNote icon="map" title={t('admin.noOnline')} body={t('adm.noOnlineBody')} />
          </View>
        ) : (
          <LiveMap data={mapData} height={190} rounded={false} />
        )}
      </Panel>

      <SectionTitle title={t('adm.recent')} />
      <Panel padded={false}>
        {activity === undefined ? (
          <View style={styles.padded}>
            <EmptyNote icon="clock" title={t('common.loading')} />
          </View>
        ) : activity === null ? (
          <View style={styles.padded}>
            <EmptyNote icon="attention" title={t('adm.failedShort')} body={t('admin.loadFailed')} />
          </View>
        ) : activity.length === 0 ? (
          <View style={styles.padded}>
            <EmptyNote icon="clock" title={t('adm.noActivity')} body={t('adm.noActivityBody')} />
          </View>
        ) : (
          activity.map((item, i) => (
            <ListRow
              key={item.key}
              leading={
                <View style={[styles.activityIcon, { backgroundColor: theme.surfaceMuted }]}>
                  <AdminIcon name={ACTIVITY[item.kind].icon} size={16} color={theme.textSecondary} />
                </View>
              }
              title={t(ACTIVITY[item.kind].text, { name: item.name, other: item.other ?? '' })}
              subtitle={shortTime(item.at, locale)}
              onPress={item.riderId ? () => router.push({ pathname: '/admin/rider/[id]', params: { id: item.riderId! } }) : undefined}
              last={i === activity.length - 1}
            />
          ))
        )}
      </Panel>
    </AdminScreen>
  );
}

/** A round count: orange when something is waiting, grey at zero. */
function CountDot({ value }: { value: Metric }) {
  const theme = useTheme();
  const waiting = typeof value === 'number' && value > 0;
  return (
    <View style={[styles.count, { backgroundColor: waiting ? theme.accent : theme.surfaceMuted }]}>
      <Txt style={[styles.countText, { color: waiting ? '#1A1206' : theme.textSecondary }]}>{value == null ? '–' : value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    marginTop: -Spacing.one,
  },
  secondaryLabel: { flex: 1, fontSize: 14 },
  secondaryValue: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  padded: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  count: { minWidth: 32, minHeight: 32, borderRadius: 16, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
