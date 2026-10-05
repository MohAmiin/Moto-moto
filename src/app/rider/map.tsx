import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AdminScreen, EmptyNote, FilterChips, Notice, Panel, SectionTitle, TopBar } from '@/components/kit';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, toDistrict } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { useAvailability } from '@/lib/rider-availability-context';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { errorKey, supabase } from '@/lib/supabase';

/** Where customers see you while you're available, and the district you work in. */
export default function RiderMap() {
  const { t } = useI18n();
  const { height } = useWindowDimensions();
  const { profile } = useAuth();
  const { online, coords } = useAvailability();
  const [area, setArea] = useState<string>(toDistrict(profile?.district));
  const [message, setMessage] = useState<string>();
  const inside = inCity(coords);
  const mapData = useMemo<LiveMapData>(() => ({ me: coords ? { ...coords, label: t('map.you') } : null, riders: [] }), [coords, t]);

  async function changeArea(next: string) {
    setArea(next);
    setMessage(undefined);
    const { error } = await supabase.from('profiles').update({ district: next }).eq('id', profile!.id);
    setMessage(error ? t(errorKey(error)) : t('rx.areaSaved'));
  }

  return (
    <AdminScreen header={<TopBar title={t('rx.mapTitle')} showProfile={false} />}>
      {!online ? (
        <Panel>
          <EmptyNote icon="map" title={t('rx.mapOffline')} body={t('rx.mapOfflineBody')} />
        </Panel>
      ) : !coords ? (
        <Panel>
          <EmptyNote icon="locate" title={t('common.loading')} />
        </Panel>
      ) : !inside ? (
        <Notice icon="pin" title={t('area.outsideRider', { city: t(`city.${ACTIVE_CITY.id}` as TKey) })} />
      ) : (
        <>
          <Panel padded={false}>
            <LiveMap data={mapData} height={Math.max(260, Math.round(height * 0.42))} rounded={false} />
          </Panel>
          <Txt variant="muted" style={styles.small}>
            {t('rider.locationShared')}
          </Txt>
        </>
      )}

      <SectionTitle title={t('rider.currentArea')} />
      <Panel>
        <View>
          <FilterChips options={AREA_OPTIONS} value={area} onChange={changeArea} />
        </View>
        <Txt variant="muted" style={styles.small} accessibilityLiveRegion="polite">
          {message ?? t('rx.areaHint')}
        </Txt>
      </Panel>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18 },
});
