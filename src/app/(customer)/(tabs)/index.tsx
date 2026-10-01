import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { RatePrompt } from '@/components/rate-prompt';
import { RiderCard } from '@/components/rider-card';
import { Button, Card, Empty, Row, Stack, Txt } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, useI18n, type TKey } from '@/lib/i18n';
import { currentPosition, type Coords } from '@/lib/location';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { supabase } from '@/lib/supabase';
import type { NearbyRider } from '@/lib/types';

// Refresh your position and the motos around you while the screen is open.
const REFRESH_MS = 15_000;
// "How it works" shows until the customer taps "Got it".
const HOW_SEEN_KEY = 'jareeye.howSeen';

type Filter = 'nearest' | 'top' | 'mine';
const FILTERS: { id: Filter; label: TKey }[] = [
  { id: 'nearest', label: 'home.filterNearest' },
  { id: 'top', label: 'home.filterTop' },
  { id: 'mine', label: 'home.filterMine' },
];

export default function FindRider() {
  const theme = useTheme();
  const { t, language, setLanguage } = useI18n();
  const { profile, session } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [riders, setRiders] = useState<NearbyRider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [filter, setFilter] = useState<Filter>('nearest');
  const [myRiders, setMyRiders] = useState<Set<string>>(new Set());
  const [howSeen, setHowSeen] = useState(true);
  const coordsRef = useRef<Coords | null>(null);
  const area = profile?.district ?? null;
  const userId = session?.user.id;

  const load = useCallback(async () => {
    // Outside the city your position isn't useful for distances, so motos are sorted by neighbourhood.
    const c = inCity(coordsRef.current) ? coordsRef.current : null;
    const [nearby, mine] = await Promise.all([
      supabase.rpc('nearby_riders', { p_lat: c?.lat ?? null, p_lng: c?.lng ?? null, p_area: area }),
      userId ? supabase.from('calls').select('rider_id').eq('caller_id', userId) : Promise.resolve({ data: [] }),
    ]);
    setRiders((nearby.data as NearbyRider[]) ?? []);
    setMyRiders(new Set(((mine.data as { rider_id: string }[] | null) ?? []).map((r) => r.rider_id)));
    setLoaded(true);
  }, [area, userId]);

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

  // Locate when the screen opens, then keep your dot and the motos live while it stays open.
  useFocusEffect(
    useCallback(() => {
      locate();
      const timer = setInterval(locate, REFRESH_MS);
      return () => clearInterval(timer);
    }, [locate]),
  );

  useEffect(() => {
    AsyncStorage.getItem(HOW_SEEN_KEY)
      .then((v) => setHowSeen(v === '1'))
      .catch(() => setHowSeen(false));
  }, []);

  function dismissHow() {
    setHowSeen(true);
    AsyncStorage.setItem(HOW_SEEN_KEY, '1').catch(() => {});
  }

  function nextLanguage() {
    const i = LANGUAGES.findIndex((l) => l.id === language);
    setLanguage(LANGUAGES[(i + 1) % LANGUAGES.length].id);
  }

  const inside = inCity(coords);
  const cityName = t(`city.${ACTIVE_CITY.id}` as TKey);
  const mapData = useMemo<LiveMapData>(
    () => ({ me: coords && inside ? { ...coords, label: t('map.you') } : null, riders: riderPoints(riders, t), recenter }),
    [coords, inside, riders, recenter, t],
  );

  const shown = useMemo(() => {
    if (filter === 'mine') return riders.filter((r) => myRiders.has(r.id));
    if (filter === 'top') return [...riders].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    return riders;
  }, [filter, riders, myRiders]);

  const mapHeight = Math.round(Math.min(Math.max(windowHeight * 0.48, 320), 520));

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.five }}>
        <View style={{ height: mapHeight }}>
          <LiveMap data={mapData} height={mapHeight} rounded={false} />
          <View style={[styles.mapTop, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
            <View style={[styles.floating, styles.brand, { backgroundColor: theme.background }]}>
              <Image source={require('@/assets/images/logo-mark.png')} style={styles.brandMark} contentFit="contain" />
              <Txt style={[styles.brandText, { color: '#0046B5' }]}>JAREEYE</Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.language')}
              onPress={nextLanguage}
              style={[styles.floating, styles.round, { backgroundColor: theme.background }]}>
              <Txt style={[styles.langCode, { color: '#0046B5' }]}>{language === 'ar' ? 'ع' : language.toUpperCase()}</Txt>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.showAll')}
            onPress={() => setRecenter((n) => n + 1)}
            style={[styles.floating, styles.round, styles.locateBtn, { backgroundColor: theme.background }]}>
            <Image source={require('@/assets/icons/locate.png')} style={styles.locateIcon} tintColor="#0046B5" />
          </Pressable>
        </View>

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.grab, { backgroundColor: theme.border }]} />
          <Stack style={styles.sheetBody}>
            <View>
              <Txt variant="title">{t('home.title')}</Txt>
              <Txt variant="muted">
                {loaded && riders.length > 0 ? t('home.online', { n: riders.length }) : coords && inside ? t('map.live') : cityName}
              </Txt>
            </View>

            <RatePrompt />

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

            {riders.length > 0 ? (
              <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
                {FILTERS.map((f) => {
                  const on = f.id === filter;
                  return (
                    <Pressable
                      key={f.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setFilter(f.id)}
                      style={[styles.chip, { backgroundColor: on ? theme.brand : theme.backgroundSelected }]}>
                      <Txt style={[styles.chipText, { color: on ? theme.onBrand : theme.brand }]}>{t(f.label)}</Txt>
                    </Pressable>
                  );
                })}
              </Row>
            ) : null}

            {loaded && riders.length === 0 ? <Empty title={t('home.noRiders')} body={t('home.noRidersBody')} /> : null}
            {riders.length > 0 && shown.length === 0 && filter === 'mine' ? <Empty title={t('home.noMine')} /> : null}
            <Stack gap={Spacing.two}>
              {shown.map((r) => (
                <RiderCard key={r.id} rider={r} />
              ))}
            </Stack>

            {howSeen ? null : (
              <Card>
                <Txt variant="heading">{t('home.howTitle')}</Txt>
                <Stack gap={Spacing.two}>
                  {(['home.how1', 'home.how2', 'home.how3'] as const).map((key, i) => (
                    <Row key={key} gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
                      <View style={[styles.step, { backgroundColor: theme.gold }]}>
                        <Txt style={{ color: theme.onGold, fontWeight: '800', fontSize: 13 }}>{i + 1}</Txt>
                      </View>
                      <Txt style={{ flex: 1 }}>{t(key)}</Txt>
                    </Row>
                  ))}
                </Stack>
                <Button title={t('home.gotIt')} kind="ghost" onPress={dismissHow} />
              </Card>
            )}
          </Stack>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mapTop: { position: 'absolute', left: Spacing.three, right: Spacing.three, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  floating: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: Radius.pill },
  brandMark: { width: 32, height: 32 },
  brandText: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  langCode: { fontSize: 15, fontWeight: '800' },
  locateBtn: { position: 'absolute', right: Spacing.three, bottom: Spacing.five + Spacing.two },
  locateIcon: { width: 24, height: 24 },
  sheet: { marginTop: -Spacing.four, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: Spacing.two },
  grab: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.two },
  sheetBody: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  step: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
