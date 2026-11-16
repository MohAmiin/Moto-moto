import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, DetailBar, EmptyNote, IconButton, Notice, Panel, SectionTitle } from '@/components/kit';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { RiderAvatar } from '@/components/rider-avatar';
import { LinkButton, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callRider } from '@/lib/call';
import { minutesAway } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { cancelMotoRequest, clock, kmBetween, rateMotoRequest, requestErrorKey, shortKm, useMotoRequest, useTicker } from '@/lib/requests';
import { ratingLabel, riderCode } from '@/lib/rider';
import { supabase } from '@/lib/supabase';
import type { MotoRequestDetail, NearbyRider } from '@/lib/types';

/** The customer's request, live: searching, no one accepted, rider on the way, delivered (rate), cancelled. */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { request, failed } = useMotoRequest(id);

  const title =
    request?.status === 'searching'
      ? t('rq.findingTitle')
      : request?.status === 'accepted'
        ? t('rq.comingTitle')
        : request?.status === 'picked_up'
          ? t('rq.pickedTitle')
          : request?.status === 'delivered'
            ? t('rq.deliveredTitle')
            : t('rq.title');

  return (
    <AdminScreen header={<DetailBar title={title} />}>
      {failed ? <Notice icon="offline" title={t('cx.offlineTitle')} body={t('rq.reconnecting')} /> : null}
      {request === undefined ? (
        <ActivityIndicator style={{ marginTop: Spacing.five }} />
      ) : request === null ? (
        <Panel>
          <EmptyNote icon="attention" title={t('rq.notFound')} />
          <AdminButton title={t('rq.close')} kind="outline" onPress={() => router.navigate('/')} />
        </Panel>
      ) : request.status === 'searching' ? (
        <Searching request={request} />
      ) : request.status === 'expired' ? (
        <Expired request={request} />
      ) : request.status === 'cancelled' ? (
        <Panel>
          <EmptyNote icon="cross" title={t('rq.cancelledTitle')} body={t('rq.cancelledBody')} />
          <AdminButton title={t('rq.close')} kind="outline" onPress={() => router.navigate('/')} />
        </Panel>
      ) : (
        <Job request={request} />
      )}
    </AdminScreen>
  );
}

function useCancel(request: MotoRequestDetail) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  async function cancel() {
    if (!confirming) return setConfirming(true);
    setBusy(true);
    try {
      await cancelMotoRequest(request.id);
    } catch (e) {
      setError(requestErrorKey(e));
    }
    setBusy(false);
    setConfirming(false);
  }
  return { cancel, busy, confirming, setConfirming, error };
}

/** Waves going out, with the time left. */
function Searching({ request }: { request: MotoRequestDetail }) {
  const theme = useTheme();
  const { t } = useI18n();
  const now = useTicker(1000);
  const left = (new Date(request.expires_at).getTime() - now) / 1000;
  const { cancel, busy, confirming, setConfirming, error } = useCancel(request);

  return (
    <>
      <Panel>
        <View style={styles.rings} accessible accessibilityLabel={t('rq.asking')}>
          <View style={[styles.ring, { width: 150, height: 150, borderColor: theme.primary, opacity: 0.15 }]} />
          <View style={[styles.ring, { width: 110, height: 110, borderColor: theme.primary, opacity: request.wave >= 2 ? 0.45 : 0.2 }]} />
          <View style={[styles.ring, { width: 72, height: 72, borderColor: theme.primary, opacity: 0.6 }]} />
          <View style={[styles.core, { backgroundColor: theme.primary }]}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        </View>
        <Txt style={styles.big} accessibilityLiveRegion="polite">
          {request.offered_count > 0 ? t('rq.asking') : t('rq.lookingWider')}
        </Txt>
        <Txt variant="muted" style={[styles.small, { textAlign: 'center' }]}>
          {t('rq.timeLeft', { time: clock(left) })}
        </Txt>
      </Panel>

      <Panel>
        <WaveLine n={1} on text={request.wave1_count > 0 ? t('rq.wave1', { n: request.wave1_count }) : t('rq.wave1None')} done />
        <WaveLine
          n={2}
          on={request.wave >= 2}
          text={request.wave >= 2 ? t('rq.wave2', { n: request.wave2_count }) : t('rq.wave2Soon')}
          done={request.wave >= 2}
        />
        <WaveLine n={3} on={false} text={t('rq.waveEnd')} done={false} />
      </Panel>

      <Stops request={request} />
      {error ? <Notice icon="attention" tone="danger" title={t(error)} /> : null}
      {confirming ? <Notice icon="attention" title={t('rq.cancelConfirm')} action={{ label: t('rq.keepIt'), onPress: () => setConfirming(false) }} /> : null}
      <AdminButton title={confirming ? t('rq.cancelYes') : t('rq.cancel')} kind={confirming ? 'danger' : 'outline'} onPress={cancel} loading={busy} />
    </>
  );
}

function WaveLine({ n, on, text, done }: { n: number; on: boolean; text: string; done: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.wave}>
      <View style={[styles.waveNum, { backgroundColor: on ? theme.primary : theme.surfaceMuted }]}>
        <Txt style={[styles.waveNumText, { color: on ? '#FFFFFF' : theme.textSecondary }]}>{n === 3 ? '–' : n}</Txt>
      </View>
      <Txt style={[styles.waveText, !on && { color: theme.textSecondary }]}>{text}</Txt>
      {done ? <Txt style={{ color: theme.success }}>✓</Txt> : null}
    </View>
  );
}

/** Nobody accepted in time: the nearby riders to call, and try again. */
function Expired({ request }: { request: MotoRequestDetail }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [riders, setRiders] = useState<NearbyRider[]>();
  useEffect(() => {
    let active = true;
    supabase.rpc('nearby_riders', { p_lat: request.pickup_lat, p_lng: request.pickup_lng, p_area: null }).then(({ data }) => {
      if (active) setRiders(((data as NearbyRider[] | null) ?? []).slice(0, 8));
    });
    return () => {
      active = false;
    };
  }, [request.pickup_lat, request.pickup_lng]);

  return (
    <>
      <Notice icon="clock" title={t('rq.noneTitle')} body={t('rq.noneBody')} />
      <SectionTitle title={t('rq.callInstead')} />
      <Panel padded={false}>
        {riders === undefined ? (
          <ActivityIndicator style={{ margin: Spacing.three }} />
        ) : riders.length === 0 ? (
          <View style={{ padding: Spacing.three }}>
            <EmptyNote icon="riders" title={t('home.noRiders')} body={t('cx.noRidersBody')} />
          </View>
        ) : (
          riders.map((r, i) => (
            <View key={r.id} style={[styles.riderRow, i < riders.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }]}>
              <RiderAvatar name={r.full_name} photoPath={r.photo_path} size={42} round />
              <View style={{ flex: 1, gap: 1 }}>
                <Txt style={styles.name} numberOfLines={1}>
                  {r.full_name}
                </Txt>
                <Txt variant="muted" style={styles.small} numberOfLines={1}>
                  {[riderCode(r.rider_number), ratingLabel(r.rating) ? `★ ${ratingLabel(r.rating)}` : t('rating.new'), shortKm(r.distance_km)].filter(Boolean).join(' · ')}
                </Txt>
              </View>
              {r.phone ? (
                <IconButton icon="phone" label={t('home.callName', { name: r.full_name })} onPress={() => callRider(r.id, r.phone!)} color={theme.accentText} style={{ borderColor: theme.accent }} />
              ) : null}
            </View>
          ))
        )}
      </Panel>
      <AdminButton title={t('rq.tryAgain')} kind="accent" icon="delivery" onPress={() => router.replace('/request/new')} />
      <AdminButton title={t('rq.close')} kind="outline" onPress={() => router.navigate('/')} />
    </>
  );
}

/** Accepted, picked up or delivered: the rider, their position, the steps; rating after delivery. */
function Job({ request }: { request: MotoRequestDetail }) {
  const { t, locale } = useI18n();
  const { cancel, busy, confirming, setConfirming, error } = useCancel(request);
  const riderAt = request.rider_lat != null && request.rider_lng != null ? { lat: request.rider_lat, lng: request.rider_lng } : null;
  const target = request.status === 'accepted' ? { lat: request.pickup_lat, lng: request.pickup_lng } : { lat: request.dropoff_lat, lng: request.dropoff_lng };
  const minutes = riderAt && request.status !== 'delivered' ? minutesAway(kmBetween(riderAt, target)) : null;
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null);

  const mapData = useMemo<LiveMapData>(
    () => ({
      me: null,
      riders: riderAt ? [{ id: 'rider', lat: riderAt.lat, lng: riderAt.lng, title: request.rider_name ?? '', subtitle: riderCode(request.rider_number)?.replace(/[⁦⁩]/g, '') }] : [],
      pickup: { lat: request.pickup_lat, lng: request.pickup_lng },
      dropoff: { lat: request.dropoff_lat, lng: request.dropoff_lng },
      selected: 'rider',
    }),
    // Re-centre only when the rider's position or the job step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [riderAt?.lat, riderAt?.lng, request.status],
  );
  const rating = ratingLabel(request.rider_rating);

  return (
    <>
      {request.status !== 'delivered' ? (
        <Panel padded={false}>
          <LiveMap data={mapData} height={220} rounded={false} />
        </Panel>
      ) : null}

      <Panel>
        <View style={styles.riderHead}>
          <RiderAvatar name={request.rider_name ?? '?'} photoPath={request.rider_photo_path} size={56} round />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={styles.riderName} numberOfLines={1}>
              {request.rider_name}
            </Txt>
            <Txt variant="muted" style={styles.small} numberOfLines={1}>
              {[riderCode(request.rider_number), request.rider_plate].filter(Boolean).join(' · ')}
            </Txt>
            <Txt variant="muted" style={styles.small}>
              {rating ? `★ ${rating} (${request.rider_rating_count})` : t('rating.new')}
              {minutes != null ? ` · ${t('cx.eta', { n: minutes })}` : ''}
            </Txt>
          </View>
        </View>
        {request.rider_phone && request.status !== 'delivered' ? (
          <AdminButton
            title={t('home.callName', { name: (request.rider_name ?? '').split(' ')[0] })}
            kind="accent"
            icon="phone"
            onPress={() => callRider(request.rider_id!, request.rider_phone!)}
          />
        ) : null}
        {riderAt == null && request.status !== 'delivered' ? (
          <Txt variant="muted" style={styles.small}>
            {t('rq.noRiderPosition')}
          </Txt>
        ) : null}
      </Panel>

      <Panel>
        <Steps status={request.status} />
        <Txt variant="muted" style={styles.small}>
          {[
            request.accepted_at && `${t('rq.sAccepted')} ${time(request.accepted_at)}`,
            request.picked_up_at && `${t('rq.sPicked')} ${time(request.picked_up_at)}`,
            request.delivered_at && `${t('rq.sDelivered')} ${time(request.delivered_at)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </Panel>

      <Stops request={request} />

      {request.status === 'delivered' ? <RateDelivery request={request} /> : null}

      {request.status === 'accepted' ? (
        <>
          {error ? <Notice icon="attention" tone="danger" title={t(error)} /> : null}
          {confirming ? (
            <Notice icon="attention" title={t('rq.cancelConfirmRider')} action={{ label: t('rq.keepIt'), onPress: () => setConfirming(false) }} />
          ) : null}
          <AdminButton title={confirming ? t('rq.cancelYes') : t('rq.cancel')} kind={confirming ? 'danger' : 'outline'} onPress={cancel} loading={busy} />
        </>
      ) : request.status === 'picked_up' ? (
        <Txt variant="muted" style={styles.small}>
          {t('rq.pickedHint')}
        </Txt>
      ) : null}
    </>
  );
}

function Steps({ status }: { status: MotoRequestDetail['status'] }) {
  const theme = useTheme();
  const { t } = useI18n();
  const reached = status === 'delivered' ? 3 : status === 'picked_up' ? 2 : 1;
  const labels: TKey[] = ['rq.sAccepted', 'rq.sPicked', 'rq.sDelivered'];
  return (
    <View style={styles.steps} accessible accessibilityLabel={labels.slice(0, reached).map((k) => t(k)).join(', ')}>
      {labels.map((k, i) => (
        <View key={k} style={styles.step}>
          <View style={[styles.stepBar, { backgroundColor: i < reached ? theme.success : theme.hairline }]} />
          <Txt style={[styles.stepText, { color: i < reached ? theme.text : theme.textSecondary }]}>{t(k)}</Txt>
        </View>
      ))}
    </View>
  );
}

function Stops({ request }: { request: MotoRequestDetail }) {
  const theme = useTheme();
  const { t } = useI18n();
  const trip = shortKm(kmBetween({ lat: request.pickup_lat, lng: request.pickup_lng }, { lat: request.dropoff_lat, lng: request.dropoff_lng }));
  return (
    <Panel>
      <View style={styles.stopRow}>
        <View style={[styles.dot, { backgroundColor: theme.primary }]} />
        <Txt style={styles.stopText} numberOfLines={1}>
          {request.pickup_label || t('rq.pickup')}
        </Txt>
      </View>
      <View style={styles.stopRow}>
        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
        <Txt style={styles.stopText} numberOfLines={1}>
          {request.dropoff_label || t('rq.dropoff')}
        </Txt>
        <Txt variant="muted" style={styles.small}>
          {trip}
        </Txt>
      </View>
      {request.note ? (
        <Txt variant="muted" style={styles.small}>
          “{request.note}”
        </Txt>
      ) : null}
    </Panel>
  );
}

function RateDelivery({ request }: { request: MotoRequestDetail }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<'rated' | 'skipped' | null>(request.rated_at ? 'skipped' : null);

  async function answer(stars: number | null) {
    setSending(true);
    try {
      await rateMotoRequest(request.id, stars);
      setDone(stars ? 'rated' : 'skipped');
    } catch {
      // The request may have been rated from another phone; either way the question is answered.
      setDone('skipped');
    }
    setSending(false);
  }

  if (done || !request.can_rate) {
    return (
      <>
        {done === 'rated' ? <Notice icon="check" tone="info" title={t('rate.thanks')} /> : null}
        <AdminButton title={t('rq.done')} onPress={() => router.navigate('/')} />
      </>
    );
  }
  return (
    <Panel>
      <Txt style={styles.big}>{t('rate.title', { name: request.rider_name ?? '' })}</Txt>
      <Txt variant="muted" style={[styles.small, { textAlign: 'center' }]}>
        {t('rate.sub')}
      </Txt>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => answer(n)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('rate.stars', { n })}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Txt style={[styles.star, { color: theme.accent }]}>★</Txt>
          </Pressable>
        ))}
      </View>
      <LinkButton title={t('rate.skip')} onPress={() => answer(null)} />
    </Panel>
  );
}

const styles = StyleSheet.create({
  rings: { height: 160, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 2 },
  core: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 18, lineHeight: 24, fontWeight: '500', textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 18 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  waveNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  waveNumText: { fontSize: 12, fontWeight: '500' },
  waveText: { flex: 1, fontSize: 14, lineHeight: 19 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  riderHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  riderName: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  steps: { flexDirection: 'row', gap: Spacing.one },
  step: { flex: 1, gap: 4 },
  stepBar: { height: 4, borderRadius: 2 },
  stepText: { fontSize: 12, lineHeight: 16 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stopText: { flex: 1, fontSize: 14, lineHeight: 19 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.three },
  star: { fontSize: 34, lineHeight: 42, minWidth: 40, textAlign: 'center' },
});
