import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminButton, Badge, Notice } from '@/components/kit';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type TKey } from '@/lib/i18n';
import { acceptMotoRequest, clock, shortKm, skipMotoRequest, useTicker } from '@/lib/requests';
import { useRiderRequests } from '@/lib/rider-requests-context';

/**
 * A request offered to this rider, over whatever tab is open: distance to pickup, the trip, the note,
 * a countdown, Skip and Accept. No customer name or number until accepted. If another rider gets it
 * first, the card says so for a moment and goes away.
 */
export function IncomingRequest() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { offers, reloadOffers, jobId, reloadJob } = useRiderRequests();
  const [busy, setBusy] = useState<'accept' | 'skip' | null>(null);
  // A message belongs to one request, so a new request never shows the last one's.
  const [message, setMessage] = useState<{ id: string; key: TKey } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const open = offers.find((o) => !o.closed_at) ?? null;
  const taken = offers.find((o) => o.outcome === 'taken' && o.request_id !== dismissed) ?? null;
  const offer = jobId ? null : (open ?? taken);
  const now = useTicker(1000, !!offer);
  const left = offer ? (new Date(offer.expires_at).getTime() - now) / 1000 : 0;
  const total = offer ? (new Date(offer.expires_at).getTime() - new Date(offer.offered_at).getTime()) / 1000 : 1;

  // A "taken" card shows for a few seconds only.
  useEffect(() => {
    if (!offer || offer.closed_at == null) return;
    const timer = setTimeout(() => setDismissed(offer.request_id), 4000);
    return () => clearTimeout(timer);
  }, [offer]);

  async function accept() {
    if (!offer) return;
    setBusy('accept');
    try {
      const result = await acceptMotoRequest(offer.request_id);
      if (result === 'ok') {
        reloadJob();
        router.navigate('/rider');
      } else {
        setMessage({ id: offer.request_id, key: result === 'taken' ? 'rq.takenTitle' : result === 'busy' ? 'rq.errBusy' : 'rq.errClosed' });
      }
    } catch {
      setMessage({ id: offer.request_id, key: 'rq.errFailed' });
    }
    setBusy(null);
    reloadOffers();
  }

  async function skip() {
    if (!offer) return;
    setBusy('skip');
    try {
      await skipMotoRequest(offer.request_id);
    } catch {
      // Skipping only hides the card; if it failed, the request expires by itself.
    }
    setDismissed(offer.request_id);
    setBusy(null);
    reloadOffers();
  }

  if (!offer) return null;
  const isTaken = offer.closed_at != null;

  return (
    <Modal transparent animationType="slide" visible statusBarTranslucent onRequestClose={skip}>
      <View style={styles.dim}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + Spacing.three }]} accessibilityViewIsModal>
          <View style={[styles.grab, { backgroundColor: theme.hairline }]} />
          {isTaken ? (
            <>
              <Txt style={styles.title}>{t('rq.takenTitle')}</Txt>
              <Txt variant="muted" style={styles.small}>
                {t('rq.takenBody')}
              </Txt>
            </>
          ) : (
            <>
              <View style={styles.head}>
                <Txt style={styles.title} accessibilityLiveRegion="assertive">
                  {t('rq.newRequest')}
                </Txt>
                <Badge tone="accent" label={t('rq.toPickup', { d: shortKm(offer.distance_km) ?? '' })} />
              </View>
              <View style={[styles.bar, { backgroundColor: theme.hairline }]}>
                <View style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(0, Math.min(100, (left / total) * 100))}%` }]} />
              </View>
              <Txt variant="muted" style={styles.small}>
                {t('rq.timeLeft', { time: clock(left) })}
              </Txt>
              <View style={[styles.stops, { backgroundColor: theme.surfaceMuted }]}>
                <View style={styles.stopRow}>
                  <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                  <Txt style={styles.stopText} numberOfLines={1}>
                    {offer.pickup_label || t('rq.pickup')}
                  </Txt>
                </View>
                <View style={styles.stopRow}>
                  <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                  <Txt style={styles.stopText} numberOfLines={1}>
                    {offer.dropoff_label || t('rq.dropoff')}
                  </Txt>
                  <Txt variant="muted" style={styles.small}>
                    {t('rq.tripKm', { d: shortKm(offer.trip_km) ?? '' })}
                  </Txt>
                </View>
              </View>
              {offer.note ? <Txt style={styles.note}>“{offer.note}”</Txt> : null}
              {message && message.id === offer.request_id ? <Notice icon="attention" title={t(message.key)} /> : null}
              <View style={styles.buttons}>
                <AdminButton title={t('rq.skip')} kind="outline" onPress={skip} loading={busy === 'skip'} disabled={busy != null} style={{ flex: 1 }} />
                <AdminButton title={t('rq.accept')} onPress={accept} loading={busy === 'accept'} disabled={busy != null || left <= 0} style={{ flex: 1.4, backgroundColor: theme.success, borderColor: theme.success }} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9, 13, 24, 0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: Spacing.three, gap: Spacing.two + 2 },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  stops: { borderRadius: 12, padding: Spacing.three - 4, gap: Spacing.two },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stopText: { flex: 1, fontSize: 15, lineHeight: 20 },
  note: { fontSize: 15, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
});
