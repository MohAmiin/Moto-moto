import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Callout, Icon, Icons, OnlineDot, Section, Stats } from '@/components/feed';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { RatePrompt } from '@/components/rate-prompt';
import { RiderAvatar } from '@/components/rider-avatar';
import { RiderCard } from '@/components/rider-card';
import { Button, Card, Empty, Monogram, Row, Stack, Txt } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { minutesAway } from '@/lib/format';
import { LANGUAGES, useI18n, type TKey } from '@/lib/i18n';
import { callRider } from '@/lib/call';
import { currentPosition, type Coords } from '@/lib/location';
import { ratingLabel, riderCode } from '@/lib/rider';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { supabase } from '@/lib/supabase';
import type { NearbyRider } from '@/lib/types';

// Refresh your position and the motos around you while the screen is open.
const REFRESH_MS = 15_000;
// "How it works" shows until the customer taps "Got it".
const HOW_SEEN_KEY = 'jareeye.howSeen';
// Faces shown in the "Motos near you" row before "+N".
const FACES = 5;
// A driver needs this many ratings before they can be called top rated.
const TOP_MIN_RATINGS = 3;

type Filter = 'nearest' | 'top' | 'mine';
const FILTERS: { id: Filter; label: TKey }[] = [
  { id: 'nearest', label: 'home.filterNearest' },
  { id: 'top', label: 'home.filterTop' },
  { id: 'mine', label: 'home.filterMine' },
];

/** "350 m" or "2.4 km" for the figures row. */
function shortDistance(km: number | null) {
  if (km == null) return '—';
  return km < 1 ? `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m` : `${km.toFixed(1)} km`;
}

/** True when this driver has the best rating among the online drivers in the same district. */
function isTopRated(rider: NearbyRider, all: NearbyRider[]) {
  if (rider.rating == null || rider.rating_count < TOP_MIN_RATINGS || !rider.area) return false;
  const mine = Number(rider.rating);
  return all.every((r) => r.id === rider.id || r.area !== rider.area || r.rating_count < TOP_MIN_RATINGS || Number(r.rating ?? 0) <= mine);
}

export default function FindRider() {
  const theme = useTheme();
  const { t, language, setLanguage } = useI18n();
  const { profile, session } = useAuth();
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
    // Outside the city your position isn't useful for distances, so motos are sorted by district.
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

  // nearby_riders() returns the nearest first (or your district first without a position).
  const nearest = riders[0] ?? null;
  const nearestMinutes = minutesAway(nearest?.distance_km);
  const extra = riders.length - FACES;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Top bar: you, the title, and the language button */}
      <View style={[styles.bar, { borderBottomColor: theme.border }]}>
        <View style={styles.barInner}>
          <View pointerEvents="none" style={styles.barTitle}>
            <Image source={require('@/assets/images/logo-mark.png')} style={styles.barMark} contentFit="contain" />
            <Txt style={styles.barText}>{t('tab.home')}</Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('tab.account')} onPress={() => router.navigate('/account')} hitSlop={6}>
            <Monogram name={profile?.full_name || 'J'} size={34} radius={17} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.language')}
            onPress={nextLanguage}
            hitSlop={6}
            style={[styles.lang, { borderColor: theme.border }]}>
            <Txt style={[styles.langCode, { color: theme.brand }]}>{language === 'ar' ? 'ع' : language.toUpperCase()}</Txt>
          </Pressable>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.five }}>
        {/* Motos near you: how many, how soon, and their faces */}
        <Section>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading">{t('home.title')}</Txt>
            {riders.length > 0 ? (
              <Row gap={6} style={[styles.live, { backgroundColor: theme.successSoft }]}>
                <OnlineDot />
                <Txt style={[styles.liveText, { color: theme.success }]}>{t('home.nearbyCount', { n: riders.length })}</Txt>
              </Row>
            ) : null}
          </Row>

          {riders.length > 0 ? (
            <Row gap={Spacing.three}>
              {nearestMinutes != null ? (
                <View style={styles.eta}>
                  <Txt style={[styles.etaValue, { color: theme.brand }]}>{nearestMinutes}</Txt>
                  <Txt style={[styles.etaUnit, { color: theme.brand }]}>{t('home.min')}</Txt>
                </View>
              ) : null}
              <Row gap={0} style={{ flex: 1 }}>
                {riders.slice(0, FACES).map((r, i) => (
                  <View
                    key={r.id}
                    style={[
                      styles.face,
                      { marginStart: i === 0 ? 0 : -10, borderColor: i === 0 ? theme.gold : theme.background, zIndex: FACES - i },
                    ]}>
                    <RiderAvatar name={r.full_name} photoPath={r.photo_path} size={40} round />
                  </View>
                ))}
                {extra > 0 ? (
                  <View style={[styles.face, styles.more, { marginStart: -10, backgroundColor: theme.backgroundElement, borderColor: theme.background }]}>
                    <Txt style={[styles.moreText, { color: theme.textSecondary }]}>{t('home.more', { n: extra })}</Txt>
                  </View>
                ) : null}
              </Row>
            </Row>
          ) : loaded ? (
            <Empty title={t('home.noRiders')} body={t('home.noRidersBody')} />
          ) : null}

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
        </Section>

        <RateBlock />

        {/* The nearest moto, as a feature card with figures, a badge, the call button and the map */}
        {nearest ? (
          <Section>
            <Row gap={Spacing.three}>
              <View>
                <RiderAvatar name={nearest.full_name} photoPath={nearest.photo_path} size={46} round />
                <View style={styles.badge}>
                  <OnlineDot size={13} ring={theme.background} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={styles.featName} numberOfLines={1}>{nearest.full_name}</Txt>
                <Txt variant="muted" style={{ fontSize: 13 }} numberOfLines={1}>
                  {[riderCode(nearest.rider_number), nearest.plate, nearest.area].filter(Boolean).join(' · ')}
                </Txt>
              </View>
            </Row>

            <Txt variant="title">{t(nearest.distance_km != null ? 'home.nearest' : 'home.suggested')}</Txt>

            <Stats
              items={[
                { label: t('home.statDistance'), value: shortDistance(nearest.distance_km) },
                { label: t('home.statTime'), value: nearestMinutes != null ? t('home.minutes', { n: nearestMinutes }) : '—' },
                {
                  label: t('home.statRating'),
                  value: nearest.rating != null ? `★ ${ratingLabel(nearest.rating)}` : t('rating.new'),
                },
              ]}
            />

            {isTopRated(nearest, riders) ? (
              <Callout icon={Icons.award} title={t('home.topRated', { area: nearest.area! })} body={t('home.topRatedBody')} />
            ) : null}

            {nearest.phone ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => callRider(nearest.id, nearest.phone!)}
                style={({ pressed }) => [styles.callBig, { backgroundColor: theme.gold, opacity: pressed ? 0.85 : 1 }]}>
                <Icon source={Icons.phone} size={22} color="#FFFFFF" />
                <Txt style={styles.callBigText} numberOfLines={1}>
                  {t('home.callName', { name: nearest.full_name.split(' ')[0] })}
                </Txt>
              </Pressable>
            ) : null}

            <View style={styles.mapWrap}>
              <LiveMap data={mapData} height={240} rounded={false} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('map.showAll')}
                onPress={() => setRecenter((n) => n + 1)}
                style={[styles.locate, { backgroundColor: theme.background }]}>
                <Icon source={Icons.locate} size={22} color={theme.brand} />
              </Pressable>
            </View>
          </Section>
        ) : null}

        {/* Everyone online, with filters */}
        {riders.length > 0 ? (
          <Section band={!howSeen}>
            <Txt variant="heading">{t('home.all')}</Txt>
            <Row gap={Spacing.two} style={{ flexWrap: 'wrap' }}>
              {FILTERS.map((f) => {
                const on = f.id === filter;
                return (
                  <Pressable
                    key={f.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setFilter(f.id)}
                    style={[styles.chip, on ? { backgroundColor: theme.text } : { borderColor: theme.border, borderWidth: 1 }]}>
                    <Txt style={[styles.chipText, { color: on ? theme.background : theme.text }]}>{t(f.label)}</Txt>
                  </Pressable>
                );
              })}
            </Row>
            {shown.length === 0 && filter === 'mine' ? <Empty title={t('home.noMine')} /> : null}
            <View>
              {shown.map((r, i) => (
                <RiderCard key={r.id} rider={r} last={i === shown.length - 1} />
              ))}
            </View>
          </Section>
        ) : null}

        {howSeen ? null : (
          <Section band={false}>
            <Txt variant="heading">{t('home.howTitle')}</Txt>
            <Stack gap={Spacing.two}>
              {(['home.how1', 'home.how2', 'home.how3'] as const).map((key, i) => (
                <Row key={key} gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
                  <View style={[styles.step, { backgroundColor: theme.gold }]}>
                    <Txt style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{i + 1}</Txt>
                  </View>
                  <Txt style={{ flex: 1 }}>{t(key)}</Txt>
                </Row>
              ))}
            </Stack>
            <Button title={t('home.gotIt')} kind="ghost" onPress={dismissHow} />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The rating question, padded like the feed; RatePrompt renders nothing when there's no call to rate. */
function RateBlock() {
  return (
    <View style={styles.rate}>
      <RatePrompt />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  barInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  barTitle: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  barMark: { width: 28, height: 28 },
  barText: { fontSize: 18, fontWeight: '700' },
  lang: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  langCode: { fontSize: 14, fontWeight: '800' },
  live: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  liveText: { fontSize: 13, fontWeight: '700' },
  eta: { alignItems: 'center', minWidth: 40 },
  etaValue: { fontSize: 28, lineHeight: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  etaUnit: { fontSize: 12, fontWeight: '700' },
  face: { borderWidth: 2.5, borderRadius: 23 },
  more: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 13, fontWeight: '700' },
  rate: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three },
  badge: { position: 'absolute', right: -1, top: -1 },
  featName: { fontSize: 16, fontWeight: '700' },
  callBig: { minHeight: 54, borderRadius: Radius.medium, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three },
  callBigText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  mapWrap: { overflow: 'hidden', marginHorizontal: -Spacing.three, marginBottom: -Spacing.three },
  locate: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.pill },
  chipText: { fontSize: 13, fontWeight: '700' },
  step: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
