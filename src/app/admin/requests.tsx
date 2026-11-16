import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AdminScreen, Badge, DetailBar, EmptyNote, FilterChips, Notice, Panel, StatCard, type BadgeTone } from '@/components/kit';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type TKey } from '@/lib/i18n';
import { clock, fetchAdminRequests, fetchRequestStats } from '@/lib/requests';
import { riderCode } from '@/lib/rider';
import { supabase } from '@/lib/supabase';
import type { AdminRequestRow, RequestStats, RequestStatus } from '@/lib/types';

type Period = 'today' | 'week' | 'month';

function since(period: Period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - 6);
  if (period === 'month') d.setDate(d.getDate() - 29);
  return d;
}

const STATUS: Record<RequestStatus, { key: TKey; tone: BadgeTone }> = {
  searching: { key: 'rq.stSearching', tone: 'accent' },
  accepted: { key: 'rq.sAccepted', tone: 'primary' },
  picked_up: { key: 'rq.sPicked', tone: 'primary' },
  delivered: { key: 'rq.sDelivered', tone: 'success' },
  cancelled: { key: 'rq.stCancelled', tone: 'neutral' },
  expired: { key: 'rq.stExpired', tone: 'warning' },
};

/** Every request with its status and times, and the period's figures. Updates live. */
export default function AdminRequests() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<Period>('today');
  const [rows, setRows] = useState<AdminRequestRow[]>();
  const [stats, setStats] = useState<RequestStats | null>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, figures] = await Promise.all([fetchAdminRequests(200), fetchRequestStats(since(period))]);
      setRows(list);
      setStats(figures);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [period]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 30_000);
    const channel = supabase
      .channel('admin-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'moto_requests' }, () => load())
      .subscribe();
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  // A figure: loading (undefined), failed (null), or the number.
  const figure = (n: number | undefined) => (stats === undefined ? (failed ? null : undefined) : (n ?? 0));
  const from = since(period).getTime();
  const shown = useMemo(() => (rows ?? []).filter((r) => new Date(r.created_at).getTime() >= from), [rows, from]);
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—');
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <AdminScreen
      header={<DetailBar title={t('rq.admTitle')} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }>
      <FilterChips
        options={[
          { id: 'today', label: t('rq.today') },
          { id: 'week', label: t('rq.week') },
          { id: 'month', label: t('rq.month') },
        ]}
        value={period}
        onChange={setPeriod}
      />
      {failed ? <Notice icon="offline" title={t('admin.loadFailed')} action={{ label: t('common.retry'), onPress: load }} /> : null}

      <View style={styles.stats}>
        <StatCard icon="delivery" label={t('rq.stSent')} value={figure(stats?.sent)} tone="neutral" />
        <StatCard icon="check" label={t('rq.stAccepted')} value={figure(stats?.accepted)} tone="success" />
        <StatCard icon="clock" label={t('rq.stExpired')} value={figure(stats?.expired)} tone={stats?.expired ? 'accent' : 'neutral'} />
        <StatCard
          icon="clock"
          label={t('rq.stAvgAccept')}
          value={stats === undefined ? figure(undefined) : stats?.avg_accept_seconds != null ? clock(stats.avg_accept_seconds) : '–'}
          tone="primary"
        />
      </View>
      {stats ? (
        <Txt variant="muted" style={styles.small}>
          {t('rq.statsLine', { delivered: stats.delivered, cancelled: stats.cancelled, open: stats.open })}
        </Txt>
      ) : null}

      <Panel padded={false}>
        {rows === undefined ? null : shown.length === 0 ? (
          <View style={{ padding: Spacing.three }}>
            <EmptyNote icon="delivery" title={t('rq.admEmpty')} body={t('rq.admEmptyBody')} />
          </View>
        ) : (
          shown.map((r, i) => {
            const s = STATUS[r.status];
            const acceptedIn = r.accepted_at ? (new Date(r.accepted_at).getTime() - new Date(r.created_at).getTime()) / 1000 : null;
            const ended = r.delivered_at ?? r.cancelled_at ?? r.expired_at;
            return (
              <View key={r.id} style={[styles.row, i < shown.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }]}>
                <View style={styles.rowHead}>
                  <Txt style={styles.who} numberOfLines={1}>
                    {r.rider_name ? `${r.customer_name} → ${r.rider_name}` : r.customer_name}
                  </Txt>
                  <Badge tone={s.tone} label={t(s.key)} />
                </View>
                <Txt variant="muted" style={styles.small} numberOfLines={1}>
                  {[r.pickup_label, r.dropoff_label].filter(Boolean).join(' → ') || '—'}
                </Txt>
                <Txt variant="muted" style={styles.small}>
                  {[
                    `${day(r.created_at)} ${time(r.created_at)}`,
                    t('rq.offeredTo', { n: r.offered_count }),
                    acceptedIn != null ? t('rq.acceptedIn', { time: clock(acceptedIn) }) : null,
                    r.rider_number != null ? riderCode(r.rider_number) : null,
                    ended ? t('rq.endedAt', { time: time(ended) }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
              </View>
            );
          })
        )}
      </Panel>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  small: { fontSize: 13, lineHeight: 18 },
  row: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  who: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '500' },
});
