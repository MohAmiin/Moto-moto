import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AdminButton, AdminIcon, AdminScreen, Badge, EmptyNote, IconButton, Notice, Panel, SectionTitle, TopBar } from '@/components/kit';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { RatePrompt } from '@/components/rate-prompt';
import { RiderAvatar } from '@/components/rider-avatar';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { callRider } from '@/lib/call';
import { minutesAway } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { currentLocation, type Coords, type LocationResult } from '@/lib/location';
import { ratingLabel, riderCode } from '@/lib/rider';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { supabase } from '@/lib/supabase';
import type { NearbyRider } from '@/lib/types';

// Refresh your position and the motos around you while the screen is open.
const REFRESH_MS = 15_000;
// "How it works" shows until the customer taps "Got it".
const HOW_SEEN_KEY = 'jareeye.howSeen';
// A driver needs this many ratings before they can be called top rated.
const TOP_MIN_RATINGS = 3;

/** "350 m" or "2.4 km". */
function shortDistance(km: number | null) {
  if (km == null) return null;
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
  const { t, locale } = useI18n();
  const { profile } = useAuth();
  // undefined until the first answer from the server.
  const [riders, setRiders] = useState<NearbyRider[]>();
  // When the latest refresh failed: riders from the last good refresh stay listed, with a warning.
  const [loadFailed, setLoadFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [location, setLocation] = useState<LocationResult>();
  const [locating, setLocating] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [howSeen, setHowSeen] = useState(true);
  const coordsRef = useRef<Coords | null>(null);
  const area = profile?.district ?? null;

  const load = useCallback(async () => {
    // Outside the city your position isn't useful for distances, so motos are sorted by district.
    const c = inCity(coordsRef.current) ? coordsRef.current : null;
    try {
      const { data, error } = await supabase.rpc('nearby_riders', { p_lat: c?.lat ?? null, p_lng: c?.lng ?? null, p_area: area });
      if (error) {
        setLoadFailed(true);
        return;
      }
      setRiders((data as NearbyRider[]) ?? []);
      setLoadFailed(false);
      setUpdatedAt(Date.now());
    } catch {
      setLoadFailed(true);
    }
  }, [area]);

  const locate = useCallback(async () => {
    setLocating(true);
    const result = await currentLocation();
    // Keep the last good position if this attempt failed, so the map doesn't jump around.
    if (result.status === 'ok' || !coordsRef.current) {
      coordsRef.current = result.status === 'ok' ? result.coords : null;
      setLocation(result);
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

  const coords = location?.status === 'ok' ? location.coords : null;
  const inside = inCity(coords);
  const cityName = t(`city.${ACTIVE_CITY.id}` as TKey);
  const list = useMemo(() => riders ?? [], [riders]);
  // nearby_riders() returns the nearest first (or your district first without a position).
  const selected = list.find((r) => r.id === selectedId) ?? null;
  const featured = selected ?? list[0] ?? null;
  const others = list.filter((r) => r.id !== featured?.id);

  const mapData = useMemo<LiveMapData>(
    () => ({ me: coords && inside ? { ...coords, label: t('map.you') } : null, riders: riderPoints(list, t), recenter, selected: featured?.id ?? null }),
    [coords, inside, list, recenter, featured?.id, t],
  );

  const place = coords && inside ? t('cx.yourLocation') : (area ?? cityName);
  const showMap = list.length > 0 || (coords && inside);

  return (
    <AdminScreen
      header={
        <TopBar
          title={place}
          subtitle={coords && inside ? cityName : area ? t('cx.districtIn', { city: cityName }) : null}
          trailing={<IconButton icon="account" label={t('tab.account')} onPress={() => router.navigate('/account')} />}
        />
      }>
      <View style={{ gap: 2 }}>
        <Txt style={styles.heading} accessibilityRole="header">
          {t('cx.title')}
        </Txt>
        {riders === undefined || list.length > 0 ? (
          <Txt variant="muted" style={styles.sub} accessibilityLiveRegion="polite">
            {riders === undefined ? t('common.loading') : t('cx.availableNow', { n: list.length })}
          </Txt>
        ) : null}
      </View>

      {loadFailed ? (
        <Notice
          icon="offline"
          title={t('cx.offlineTitle')}
          body={
            updatedAt
              ? t('cx.offlineBody', { time: new Date(updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
              : t('home.loadFailedEmpty')
          }
          action={{ label: t('common.retry'), onPress: locate, busy: locating }}
        />
      ) : null}
      {location?.status === 'denied' ? (
        <Notice
          icon="locationOff"
          title={t('cx.locDeniedTitle')}
          body={t('cx.locDeniedBody')}
          action={
            location.canAskAgain
              ? { label: t('cx.allow'), onPress: locate, busy: locating }
              : { label: t('cx.openSettings'), onPress: () => Linking.openSettings() }
          }
        />
      ) : location?.status === 'unavailable' ? (
        <Notice icon="locationOff" title={t('cx.locOffTitle')} body={t('cx.locOffBody')} action={{ label: t('common.retry'), onPress: locate, busy: locating }} />
      ) : coords && !inside ? (
        <Notice icon="pin" tone="info" title={t('cx.outsideTitle', { city: cityName })} body={t('cx.outsideBody')} />
      ) : null}

      {showMap ? (
        <Panel padded={false}>
          <LiveMap data={mapData} height={240} rounded={false} onSelect={setSelectedId} />
          <IconButton icon="locate" label={t('map.showAll')} onPress={() => setRecenter((n) => n + 1)} color={theme.primaryText} style={styles.recenter} />
        </Panel>
      ) : null}

      {featured ? (
        <FeaturedRider rider={featured} label={selected ? t('cx.selected') : featured.distance_km != null ? t('cx.nearest') : t('home.suggested')} topRated={isTopRated(featured, list)} />
      ) : riders !== undefined && !loadFailed ? (
        <Panel>
          <EmptyNote icon="riders" title={t('home.noRiders')} body={t('cx.noRidersBody')} />
        </Panel>
      ) : null}

      <RatePrompt />

      {others.length > 0 ? (
        <>
          <SectionTitle title={t('cx.others', { n: others.length })} />
          <Panel padded={false}>
            {others.map((r, i) => (
              <OtherRider key={r.id} rider={r} onSelect={() => setSelectedId(r.id)} last={i === others.length - 1} />
            ))}
          </Panel>
        </>
      ) : null}

      {howSeen ? null : (
        <Panel>
          <Txt style={styles.howTitle}>{t('home.howTitle')}</Txt>
          {(['home.how1', 'home.how2', 'home.how3'] as const).map((key, i) => (
            <View key={key} style={styles.howRow}>
              <View style={[styles.howNum, { backgroundColor: theme.primarySoft }]}>
                <Txt style={[styles.howNumText, { color: theme.primaryText }]}>{i + 1}</Txt>
              </View>
              <Txt variant="muted" style={styles.howText}>
                {t(key)}
              </Txt>
            </View>
          ))}
          <AdminButton title={t('home.gotIt')} kind="outline" onPress={dismissHow} />
        </Panel>
      )}
    </AdminScreen>
  );
}

/** The rider to call: photo, name, number, distance, an estimated time, rating, and the orange Call button. */
function FeaturedRider({ rider, label, topRated }: { rider: NearbyRider; label: string; topRated: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  const distance = shortDistance(rider.distance_km);
  const minutes = minutesAway(rider.distance_km);
  const rating = ratingLabel(rider.rating);
  return (
    <Panel style={{ borderColor: theme.accent, borderWidth: 1 }}>
      <View style={styles.featHead}>
        <RiderAvatar name={rider.full_name} photoPath={rider.photo_path} size={56} round />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="muted" style={styles.featLabel}>
            {label}
          </Txt>
          <Txt style={styles.featName} numberOfLines={1}>
            {rider.full_name}
          </Txt>
          <Txt variant="muted" style={styles.small} numberOfLines={1}>
            {[riderCode(rider.rider_number), rider.plate].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      </View>
      <View style={styles.facts}>
        {distance ? <Fact icon="pin" text={t('cx.away', { d: distance })} /> : rider.area ? <Fact icon="pin" text={rider.area} /> : null}
        {minutes != null ? <Fact icon="clock" text={t('cx.eta', { n: minutes })} /> : null}
        <Fact icon="star" text={rating ? `${rating} (${rider.rating_count})` : t('rating.new')} />
      </View>
      {topRated ? <Badge tone="accent" label={t('cx.topRated', { area: rider.area! })} /> : null}
      {rider.phone ? (
        <AdminButton
          title={t('home.callName', { name: rider.full_name.split(' ')[0] })}
          kind="accent"
          icon="phone"
          onPress={() => callRider(rider.id, rider.phone!)}
          style={styles.call}
        />
      ) : null}
    </Panel>
  );
}

function Fact({ icon, text }: { icon: 'pin' | 'clock' | 'star'; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, { backgroundColor: theme.surfaceMuted }]}>
      <AdminIcon name={icon} size={13} color={theme.textSecondary} />
      <Txt style={styles.factText}>{text}</Txt>
    </View>
  );
}

/** Another available rider: tap the row to show them on the map and in the card above; call directly. */
function OtherRider({ rider, onSelect, last }: { rider: NearbyRider; onSelect: () => void; last: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  const distance = shortDistance(rider.distance_km);
  const rating = ratingLabel(rider.rating);
  return (
    <View style={[styles.other, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('cx.showOnMap')}
        onPress={onSelect}
        style={({ pressed }) => [styles.otherMain, pressed && { opacity: 0.7 }]}>
        <RiderAvatar name={rider.full_name} photoPath={rider.photo_path} size={42} round />
        <View style={{ flex: 1, gap: 1 }}>
          <Txt style={styles.otherName} numberOfLines={1}>
            {rider.full_name}
          </Txt>
          <Txt variant="muted" style={styles.small} numberOfLines={1}>
            {[riderCode(rider.rider_number), distance ?? rider.area, rating ? `★ ${rating}` : t('rating.new')].filter(Boolean).join(' · ')}
          </Txt>
        </View>
      </Pressable>
      {rider.phone ? (
        <IconButton
          icon="phone"
          label={t('home.callName', { name: rider.full_name })}
          onPress={() => callRider(rider.id, rider.phone!)}
          color={theme.accentText}
          style={{ borderColor: theme.accent }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 21, lineHeight: 27, fontWeight: '500' },
  sub: { fontSize: 14, lineHeight: 19 },
  recenter: { position: 'absolute', right: Spacing.two + 2, bottom: Spacing.two + 2 },
  featHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  featLabel: { fontSize: 12, lineHeight: 16 },
  featName: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  factText: { fontSize: 13, lineHeight: 17 },
  call: { minHeight: 52, marginTop: Spacing.one },
  other: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingEnd: Spacing.three },
  otherMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, minHeight: 60, paddingVertical: Spacing.two, paddingStart: Spacing.three },
  otherName: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  howTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two + 2 },
  howNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  howNumText: { fontSize: 12, fontWeight: '500' },
  howText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
