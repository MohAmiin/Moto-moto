import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { AdminButton, Badge, Notice, Panel } from '@/components/kit';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { Monogram, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { telUrl } from '@/lib/call-log';
import { useI18n } from '@/lib/i18n';
import { kmBetween, setRequestStatus, shortKm, useMotoRequest } from '@/lib/requests';
import { useAvailability } from '@/lib/rider-availability-context';
import { useRiderRequests } from '@/lib/rider-requests-context';

/**
 * The rider's current job: where to go next, the customer to call, and one button that moves it on
 * (I picked it up, then I delivered it). While it is open the rider counts as busy.
 */
export function ActiveJob({ jobId }: { jobId: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { request } = useMotoRequest(jobId);
  const { coords } = useAvailability();
  const { reloadJob } = useRiderRequests();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const picked = request?.status === 'picked_up';
  const target = request ? (picked ? { lat: request.dropoff_lat, lng: request.dropoff_lng } : { lat: request.pickup_lat, lng: request.pickup_lng }) : null;
  const mapData = useMemo<LiveMapData>(
    () => ({
      me: coords ? { ...coords, label: t('map.you') } : null,
      riders: [],
      pickup: request ? { lat: request.pickup_lat, lng: request.pickup_lng } : null,
      dropoff: request ? { lat: request.dropoff_lat, lng: request.dropoff_lng } : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords?.lat, coords?.lng, request?.id, t],
  );

  if (!request) {
    return (
      <Panel>
        <ActivityIndicator />
      </Panel>
    );
  }
  if (request.status !== 'accepted' && request.status !== 'picked_up') {
    // Cancelled by the customer or finished: the Home screen updates with the next refresh.
    return request.status === 'cancelled' ? <Notice icon="cross" title={t('rq.jobCancelled')} /> : null;
  }

  async function advance() {
    setSaving(true);
    setFailed(false);
    try {
      await setRequestStatus(request!.id, picked ? 'delivered' : 'picked_up');
      reloadJob();
    } catch {
      setFailed(true);
    }
    setSaving(false);
  }

  const away = coords && target ? shortKm(kmBetween(coords, target)) : null;
  return (
    <>
      <Panel padded={false}>
        <LiveMap data={mapData} height={200} rounded={false} />
      </Panel>
      <Panel>
        <View style={styles.head}>
          <Txt style={styles.title}>{picked ? t('rq.goDropoff') : t('rq.goPickup')}</Txt>
          <Badge tone="primary" label={t('rider.busy')} />
        </View>
        <View style={styles.stopRow}>
          <View style={[styles.dot, { backgroundColor: picked ? theme.accent : theme.primary }]} />
          <Txt style={styles.stopText} numberOfLines={2}>
            {(picked ? request.dropoff_label : request.pickup_label) || (picked ? t('rq.dropoff') : t('rq.pickup'))}
          </Txt>
          {away ? (
            <Txt variant="muted" style={styles.small}>
              {away}
            </Txt>
          ) : null}
        </View>
        {request.note ? <Txt style={styles.note}>“{request.note}”</Txt> : null}
        <View style={[styles.customer, { borderTopColor: theme.hairline }]}>
          <Monogram name={request.customer_name || '?'} size={40} radius={20} />
          <View style={{ flex: 1 }}>
            <Txt style={styles.name} numberOfLines={1}>
              {request.customer_name}
            </Txt>
            <Txt variant="muted" style={styles.small}>
              {t('rq.customer')}
            </Txt>
          </View>
          {request.customer_phone ? (
            <AdminButton title={t('rq.callCustomer')} kind="outline" icon="phone" onPress={() => Linking.openURL(telUrl(request.customer_phone!))} />
          ) : null}
        </View>
      </Panel>
      {failed ? <Notice icon="attention" tone="danger" title={t('rq.errFailed')} /> : null}
      <AdminButton title={picked ? t('rq.delivered') : t('rq.pickedUp')} onPress={advance} loading={saving} style={styles.main} />
      <Txt variant="muted" style={styles.small}>
        {picked ? t('rq.deliveredHint') : t('rq.pickedUpHint')}
      </Txt>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stopText: { flex: 1, fontSize: 15, lineHeight: 20 },
  note: { fontSize: 14, lineHeight: 20 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two + 2 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  main: { minHeight: 52 },
});
