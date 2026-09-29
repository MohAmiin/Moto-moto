import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { RiderCard } from '@/components/rider-card';
import { Button, Card, Empty, LinkButton, Row, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n, type TKey } from '@/lib/i18n';
import { currentPosition, type Coords } from '@/lib/location';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { supabase } from '@/lib/supabase';
import type { NearbyRider } from '@/lib/types';

// Refresh your position and the riders around you while the screen is open.
const REFRESH_MS = 15_000;

export default function FindRider() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useAuth();
  const [riders, setRiders] = useState<NearbyRider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const coordsRef = useRef<Coords | null>(null);
  const area = profile?.district ?? null;

  const load = useCallback(async () => {
    // Outside the city your position isn't useful for distances, so riders are sorted by neighbourhood.
    const c = inCity(coordsRef.current) ? coordsRef.current : null;
    const { data } = await supabase.rpc('nearby_riders', { p_lat: c?.lat ?? null, p_lng: c?.lng ?? null, p_area: area });
    setRiders((data as NearbyRider[]) ?? []);
    setLoaded(true);
  }, [area]);

  const locate = useCallback(async () => {
    setLocating(true);
    const c = await currentPosition();
    if (c || !coordsRef.current) {
      coordsRef.current = c;
      setCoords(c);
    }
    setLocating(false);
    await load();
  }, [load]);

  // Locate when the screen opens, then keep your dot and the riders live while it stays open.
  useFocusEffect(
    useCallback(() => {
      locate();
      const timer = setInterval(locate, REFRESH_MS);
      return () => clearInterval(timer);
    }, [locate]),
  );

  const inside = inCity(coords);
  const cityName = t(`city.${ACTIVE_CITY.id}` as TKey);
  const mapData = useMemo<LiveMapData>(
    () => ({ me: coords && inside ? { ...coords, label: t('map.you') } : null, riders: riderPoints(riders, t), recenter }),
    [coords, inside, riders, recenter, t],
  );

  return (
    <Screen edges={['top']}>
      <View style={[styles.hero, { backgroundColor: '#14213D' }]}>
        <Row gap={Spacing.two}>
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} contentFit="contain" />
          <Txt style={styles.wordmark}>SABIQ</Txt>
        </Row>
        <Txt variant="title" style={{ color: '#FFFFFF' }}>{t('home.title')}</Txt>
        <Txt style={{ color: '#FFFFFF', opacity: 0.85 }}>{t('home.sub')}</Txt>
      </View>

      <LiveMap data={mapData} height={320} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="muted" style={{ flex: 1 }}>{coords && inside ? t('map.live') : cityName}</Txt>
        <LinkButton title={t('map.showAll')} onPress={() => setRecenter((n) => n + 1)} />
      </Row>

      {coords && !inside ? (
        <Card tone="soft">
          <Txt>{t('area.outside', { city: cityName })}</Txt>
        </Card>
      ) : null}

      {coords ? null : (
        <Card tone="soft">
          <Txt>{t('home.locationOff')}</Txt>
          <Button title={t('home.useLocation')} kind="ghost" onPress={locate} loading={locating} />
        </Card>
      )}

      {loaded && riders.length === 0 ? <Empty title={t('home.noRiders')} body={t('home.noRidersBody')} /> : null}
      {riders.map((r) => (
        <RiderCard key={r.id} rider={r} />
      ))}

      <Card>
        <Txt variant="heading">{t('home.howTitle')}</Txt>
        <Stack gap={Spacing.two}>
          {(['home.how1', 'home.how2', 'home.how3'] as const).map((key, i) => (
            <Row key={key} gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
              <View style={[styles.step, { backgroundColor: theme.gold }]}>
                <Txt style={{ color: theme.onGold, fontWeight: '900', fontSize: 13 }}>{i + 1}</Txt>
              </View>
              <Txt style={{ flex: 1 }}>{t(key)}</Txt>
            </Row>
          ))}
        </Stack>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  logo: { width: 36, height: 36 },
  wordmark: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  step: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
