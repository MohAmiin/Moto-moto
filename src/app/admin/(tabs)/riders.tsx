import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AdminScreen, Badge, EmptyNote, FilterChips, ListRow, Panel, SearchField, TopBar, type BadgeTone } from '@/components/kit';
import { ConnectionBanner } from '@/components/connection-banner';
import { RiderAvatar } from '@/components/rider-avatar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchApplications, fetchOnlineRiders, matchesRiderNumber, onlineLabel, searchKey, useAdminRefresh, usePullToRefresh, type Application, type OnlineRider } from '@/lib/admin';
import { formatPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { MEMBERSHIP_LOOK, fetchMembershipSettings, fetchMemberships, needsPayment } from '@/lib/membership';
import { riderCode } from '@/lib/rider';
import type { Membership } from '@/lib/types';

// "expiring" and "renew" (expired or unpaid) only appear while paid membership is on.
const FILTERS = ['all', 'pending', 'approved', 'online', 'expiring', 'renew', 'rejected'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS: Record<Application['status'], { label: TKey; tone: BadgeTone }> = {
  pending: { label: 'admin.pending', tone: 'accent' },
  approved: { label: 'admin.approved', tone: 'success' },
  rejected: { label: 'admin.rejected', tone: 'danger' },
};

export default function Riders() {
  const theme = useTheme();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ filter?: string }>();
  const asFilter = (f: string | undefined): Filter | null => (f && (FILTERS as readonly string[]).includes(f) ? (f as Filter) : null);
  const [filter, setFilter] = useState<Filter>(asFilter(params.filter) ?? 'all');
  // Overview links here with a filter, e.g. pending approvals; a new link switches to it.
  const [linked, setLinked] = useState(params.filter);
  if (params.filter !== linked) {
    setLinked(params.filter);
    const next = asFilter(params.filter);
    if (next) setFilter(next);
  }
  const [query, setQuery] = useState('');
  const [apps, setApps] = useState<Application[]>();
  const [online, setOnline] = useState<Map<string, OnlineRider>>(new Map());
  const [memberships, setMemberships] = useState<Map<string, Membership>>(new Map());
  const [required, setRequired] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [a, o, m, settings] = await Promise.all([
        fetchApplications(),
        fetchOnlineRiders(),
        // Memberships are an extra: if they can't be read, the list works as with membership off.
        fetchMemberships().catch(() => new Map<string, Membership>()),
        fetchMembershipSettings().catch(() => null),
      ]);
      setApps(a);
      setOnline(new Map(o.map((r) => [r.id, r])));
      setMemberships(m);
      setRequired(settings?.required ?? false);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useAdminRefresh(load, 'admin-riders');
  const pull = usePullToRefresh(load);

  const counts = useMemo(() => {
    const list = apps ?? [];
    return {
      all: list.length,
      pending: list.filter((a) => a.status === 'pending').length,
      approved: list.filter((a) => a.status === 'approved').length,
      rejected: list.filter((a) => a.status === 'rejected').length,
      online: list.filter((a) => online.has(a.user_id)).length,
      expiring: list.filter((a) => a.status === 'approved' && memberships.get(a.user_id)?.status === 'expiring').length,
      renew: list.filter((a) => a.status === 'approved' && needsPayment(memberships.get(a.user_id)?.status)).length,
    } satisfies Record<Filter, number>;
  }, [apps, online, memberships]);
  // Membership filters only while paid membership is on.
  const filters = FILTERS.filter((f) => required || (f !== 'expiring' && f !== 'renew'));
  const activeFilter: Filter = filters.includes(filter) ? filter : 'all';

  const shown = useMemo(() => {
    const q = searchKey(query);
    return (apps ?? []).filter((a) => {
      const m = memberships.get(a.user_id)?.status;
      if (activeFilter === 'online' && !online.has(a.user_id)) return false;
      if (activeFilter === 'expiring' && !(a.status === 'approved' && m === 'expiring')) return false;
      if (activeFilter === 'renew' && !(a.status === 'approved' && needsPayment(m))) return false;
      if (['pending', 'approved', 'rejected'].includes(activeFilter) && a.status !== activeFilter) return false;
      if (!q) return true;
      return (
        searchKey(a.profile?.full_name).includes(q) ||
        searchKey(a.profile?.phone).includes(q.replace(/^0/, '')) ||
        matchesRiderNumber(a.rider_number, query)
      );
    });
  }, [apps, activeFilter, query, online, memberships]);

  const labels: Record<Filter, TKey> = {
    all: 'adm.all',
    pending: 'admin.pending',
    approved: 'admin.approved',
    rejected: 'admin.rejected',
    online: 'adm.reportingOnline',
    expiring: 'mem.expiring',
    renew: 'mem.filterRenew',
  };

  return (
    <AdminScreen
      header={<TopBar title={t('adm.riders')} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.textSecondary} />}>
      <SearchField value={query} onChangeText={setQuery} placeholder={t('adm.searchRiders')} />
      <FilterChips options={filters.map((id) => ({ id, label: t(labels[id]), count: apps ? counts[id] : undefined }))} value={activeFilter} onChange={setFilter} />
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}

      <Panel padded={false}>
        {apps === undefined ? (
          <View style={styles.padded}>
            <EmptyNote icon="riders" title={failed ? t('adm.failedShort') : t('common.loading')} />
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.padded}>
            <EmptyNote
              icon={query ? 'search' : 'riders'}
              title={query ? t('adm.noMatches') : t('admin.noApplications')}
              body={query ? t('adm.noMatchesBody') : activeFilter === 'pending' ? t('adm.noPendingBody') : undefined}
            />
          </View>
        ) : (
          shown.map((a, i) => {
            const live = online.get(a.user_id);
            // While paid membership is on, approved riders show their membership instead.
            const m = required && a.status === 'approved' ? memberships.get(a.user_id) : undefined;
            const status = m ? MEMBERSHIP_LOOK[m.status] : STATUS[a.status];
            const code = riderCode(a.rider_number);
            const name = a.profile?.full_name ?? '—';
            return (
              <ListRow
                key={a.user_id}
                leading={<RiderAvatar name={name} photoPath={a.profile?.photo_path} size={42} round />}
                title={name}
                subtitle={[code, formatPhone(a.profile?.phone), live ? t(onlineLabel(live).label) : null].filter(Boolean).join(' · ')}
                trailing={<Badge label={t(status.label)} tone={status.tone} />}
                onPress={() => router.push({ pathname: '/admin/rider/[id]', params: { id: a.user_id } })}
                last={i === shown.length - 1}
              />
            );
          })
        )}
      </Panel>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
