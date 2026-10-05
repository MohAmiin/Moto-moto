import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, Notice, Panel, SectionTitle, TopBar } from '@/components/kit';
import { RiderAvatar } from '@/components/rider-avatar';
import { RiderMembershipCard } from '@/components/rider-membership-card';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { needsPayment, useMyMembership } from '@/lib/membership';
import { ratingLabel, riderCode } from '@/lib/rider';
import { useAvailability } from '@/lib/rider-availability-context';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { supabase } from '@/lib/supabase';

/** Midnight at the start of the day `daysAgo` days before today, in local time. */
function dayStart(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

type CallRow = { created_at: string };

/** Call taps today and in the last 7 days. A tap is someone pressing Call on this rider; it doesn't show whether the call connected. */
function summarize(rows: CallRow[]) {
  const weekStart = dayStart(6);
  const today = dayStart(0);
  const recent = rows.map((r) => new Date(r.created_at)).filter((d) => d >= weekStart);
  return { today: recent.filter((d) => d >= today).length, week: recent.length };
}

/** Re-renders every `ms` so countdowns stay current. The clock is read in the timer, not during render. */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

const ERRORS: Record<'noLocation' | 'saveFailed' | 'endedElsewhere', TKey> = {
  noLocation: 'rider.needLocation',
  saveFailed: 'rider.saveFailed',
  endedElsewhere: 'rider.endedElsewhere',
};

export default function RiderHome() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { profile, application } = useAuth();
  const { online, busy, busyUntil, pending, coords, locationFresh, connected, error, controller } = useAvailability();
  const [calls, setCalls] = useState<CallRow[]>();
  const [rating, setRating] = useState<string | null | undefined>();
  const [statsFailed, setStatsFailed] = useState(false);
  const now = useNow(30_000);
  // While paid membership is on, an expired or unpaid rider can't go online (the database refuses it too).
  const { membership, reload: reloadMembership } = useMyMembership();
  const blocked = needsPayment(membership?.status);
  const stats = useMemo(() => (calls ? summarize(calls) : null), [calls]);
  const riderId = profile!.id;

  // Call taps on this rider (riders can read their own) for the week and today; the rating is one current
  // rating per customer, from my_rating().
  const loadStats = useCallback(async () => {
    const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const [taps, mine] = await Promise.all([
      supabase.from('calls').select('created_at').eq('rider_id', riderId).gte('created_at', since),
      supabase.rpc('my_rating'),
    ]);
    if (!taps.error) setCalls((taps.data as CallRow[] | null) ?? []);
    if (!mine.error) setRating(ratingLabel((mine.data as { rating: number | null }[] | null)?.[0]?.rating));
    setStatsFailed(!!(taps.error || mine.error));
  }, [riderId]);

  useEffect(() => {
    const first = setTimeout(loadStats, 0);
    const timer = setInterval(loadStats, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loadStats]);

  const state: 'offline' | 'available' | 'busy' = busy ? 'busy' : online ? 'available' : 'offline';
  const minutesLeft = busy && busyUntil ? Math.max(1, Math.ceil((new Date(busyUntil).getTime() - now) / 60_000)) : 0;
  const untilTime = busyUntil ? new Date(busyUntil).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
  const look = {
    offline: { dot: theme.textSecondary, bg: theme.surfaceMuted, fg: theme.text, title: t('rider.offlineTitle'), body: t('rx.offlineBody') },
    available: { dot: theme.success, bg: theme.successSoft, fg: theme.success, title: t('rx.available'), body: t('rx.availableBody', { phone: formatPhone(profile!.phone) }) },
    busy: { dot: theme.primaryText, bg: theme.primarySoft, fg: theme.primaryText, title: t('rx.busyLeft', { n: minutesLeft }), body: t('rx.busyBody', { time: untilTime }) },
  }[state];
  const saving = pending === 'online' ? t('rider.goingOnline') : pending ? t('common.saving') : null;
  const code = riderCode(application?.rider_number);

  return (
    <AdminScreen
      header={
        <TopBar
          title={profile!.full_name}
          subtitle={[code, application?.plate].filter(Boolean).join(' · ')}
          leading={<RiderAvatar name={profile!.full_name} photoPath={profile!.photo_path} size={38} round />}
          showProfile={false}
        />
      }>
      {/* Availability first: it's what riders check on the road. */}
      <Panel>
        <View style={[styles.status, { backgroundColor: look.bg }]} accessibilityLiveRegion="polite">
          <View style={[styles.dot, { backgroundColor: look.dot }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={[styles.statusTitle, { color: look.fg }]}>{look.title}</Txt>
            <Txt variant="muted" style={styles.small}>
              {look.body}
            </Txt>
          </View>
        </View>

        {state === 'offline' ? (
          <AdminButton
            title={t('rx.goOnline')}
            icon="power"
            // Afterwards re-check the membership: if the database refused, the screen explains why.
            onPress={() => controller.goOnline().then(reloadMembership)}
            loading={pending === 'online'}
            disabled={pending != null || blocked}
          />
        ) : state === 'available' ? (
          <>
            <AdminButton title={t('rider.goBusy')} icon="delivery" onPress={() => controller.setBusy(true)} loading={pending === 'busy'} disabled={pending != null} />
            <AdminButton title={t('rx.goOffline')} kind="outline" onPress={() => controller.goOffline()} loading={pending === 'offline'} disabled={pending != null} />
          </>
        ) : (
          <>
            <AdminButton title={t('rider.goFree')} onPress={() => controller.setBusy(false)} loading={pending === 'free'} disabled={pending != null} />
            <AdminButton title={t('rx.goOffline')} kind="outline" onPress={() => controller.goOffline()} loading={pending === 'offline'} disabled={pending != null} />
          </>
        )}
        {membership?.status === 'active' ? (
          <Txt variant="muted" style={styles.small}>
            {t('mem.activeLine', { n: membership.days_left ?? 0 })}
          </Txt>
        ) : null}
        {saving ? (
          <Txt variant="muted" style={styles.small} accessibilityLiveRegion="polite">
            {saving}
          </Txt>
        ) : null}
      </Panel>

      <RiderMembershipCard membership={membership} compact />
      {error && !(blocked && error === 'saveFailed') ? <Notice icon="attention" tone="danger" title={t(ERRORS[error])} /> : null}
      {online && connected === false ? <Notice icon="offline" title={t('rider.connectionLost')} body={t('rx.connectionBody')} /> : null}
      {online && connected !== false && locationFresh === false ? <Notice icon="locationOff" title={t('rider.locationStale')} body={t('rx.locationBody')} /> : null}
      {online && coords && !inCity(coords) ? (
        <Notice icon="pin" title={t('area.outsideRider', { city: t(`city.${ACTIVE_CITY.id}` as TKey) })} />
      ) : null}
      {online ? <Notice icon="info" tone="info" title={t('rx.keepOpenTitle')} body={t('rx.keepOpenBody')} /> : null}
      {!profile!.photo_path ? (
        <Notice icon="camera" tone="info" title={t('rider.addPhotoTitle')} body={t('rider.addPhotoBody')} action={{ label: t('rider.addPhoto'), onPress: () => router.navigate('/rider/account') }} />
      ) : null}

      <SectionTitle title={t('rx.callTaps')} />
      <Panel>
        <View style={styles.stats}>
          <Stat label={t('rx.today')} value={stats ? String(stats.today) : statsFailed ? '–' : '…'} />
          <Stat label={t('rx.thisWeek')} value={stats ? String(stats.week) : statsFailed ? '–' : '…'} />
          <Stat label={t('rider.statRating')} value={rating === undefined ? (statsFailed ? '–' : '…') : rating ? `★ ${rating}` : t('rating.new')} />
        </View>
        <Txt variant="muted" style={styles.small}>
          {t('rx.tapsNote')}
        </Txt>
      </Panel>
    </AdminScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="muted" style={styles.small} numberOfLines={2}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, borderRadius: 12, padding: Spacing.three - 2 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 22, lineHeight: 28, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
