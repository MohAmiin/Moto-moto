import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AdminScreen, Badge, DetailBar, EmptyNote, ListRow, Panel, SectionTitle } from '@/components/kit';
import { ConnectionBanner } from '@/components/connection-banner';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { RiderAvatar } from '@/components/rider-avatar';
import { Spacing } from '@/constants/theme';
import { fetchOnlineRiders, useAdminRefresh } from '@/lib/admin';
import { useI18n } from '@/lib/i18n';
import { riderCode } from '@/lib/rider';
import type { NearbyRider } from '@/lib/types';

/** Every rider online now, available or busy, on a map and in a list. */
export default function AdminMap() {
  const { t } = useI18n();
  const { height } = useWindowDimensions();
  const [online, setOnline] = useState<NearbyRider[]>();
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setOnline(await fetchOnlineRiders());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useAdminRefresh(load, 'admin-map');

  const data = useMemo<LiveMapData>(() => ({ me: null, riders: riderPoints(online ?? [], t) }), [online, t]);
  const noPosition = (online ?? []).filter((r) => r.lat == null || r.lng == null).length;

  return (
    <AdminScreen edges={['top', 'bottom']} header={<DetailBar title={t('adm.ridersOnMap')} />}>
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}
      <Panel padded={false}>
        <LiveMap data={data} height={Math.max(280, Math.round(height * 0.45))} rounded={false} />
      </Panel>
      <SectionTitle title={online ? `${t('admin.online')} · ${online.length}` : t('admin.online')} />
      <Panel padded={false}>
        {online === undefined ? (
          <View style={styles.padded}>
            <EmptyNote icon="riders" title={failed ? t('adm.failedShort') : t('common.loading')} />
          </View>
        ) : online.length === 0 ? (
          <View style={styles.padded}>
            <EmptyNote icon="riders" title={t('admin.noOnline')} body={t('adm.noOnlineBody')} />
          </View>
        ) : (
          online.map((r, i) => (
            <ListRow
              key={r.id}
              leading={<RiderAvatar name={r.full_name} photoPath={r.photo_path} size={40} round />}
              title={r.full_name}
              subtitle={[riderCode(r.rider_number), r.plate, r.area, r.lat == null ? t('adm.noPosition') : null].filter(Boolean).join(' · ')}
              trailing={<Badge label={t(r.is_busy ? 'adm.busy' : 'adm.available')} tone={r.is_busy ? 'primary' : 'success'} />}
              onPress={() => router.push({ pathname: '/admin/rider/[id]', params: { id: r.id } })}
              last={i === online.length - 1}
            />
          ))
        )}
      </Panel>
      {noPosition > 0 ? <EmptyNote icon="map" title={t('adm.someNoPosition', { n: noPosition })} /> : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
});
