import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Callout, Icon, Icons, Section, Stats } from '@/components/feed';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { DeleteAccount } from '@/components/delete-account';
import { RiderApplicationForm } from '@/components/rider-application-form';
import { RiderAvatar } from '@/components/rider-avatar';
import { Button, Card, Choices, Header, LanguageSwitcher, LinkButton, Row, Screen, Stack, Txt } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, formatPhone, toDistrict } from '@/lib/format';
import { LANGUAGES, useI18n, type TKey } from '@/lib/i18n';
import { currentPosition, type Coords } from '@/lib/location';
import { ratingLabel, riderCode, uploadRiderPhoto } from '@/lib/rider';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { errorKey, supabase } from '@/lib/supabase';

// While online, refresh the rider's position and "last seen" so people see who is really available.
const PING_MS = 30_000;
// "I'm on a delivery" hides the driver for this long, in case they forget to come back.
const BUSY_MINUTES = 45;

export default function RiderHome() {
  const { t } = useI18n();
  const { profile, application, signOut } = useAuth();
  if (!profile) return null;

  if (!application || application.status === 'rejected') {
    const rejected = application?.status === 'rejected';
    return (
      <Screen>
        <LanguageSwitcher />
        <Header
          title={t(rejected ? 'rider.rejectedTitle' : 'rider.completeTitle')}
          subtitle={t(rejected ? 'rider.rejectedSub' : 'rider.completeSub')}
          back={false}
        />
        <RiderApplicationForm createProfile={false} />
        <LinkButton title={t('common.signOut')} onPress={signOut} />
        <DeleteAccount />
      </Screen>
    );
  }

  if (application.status === 'pending') {
    return (
      <Screen>
        <LanguageSwitcher />
        <Stack style={{ alignItems: 'center', paddingTop: Spacing.four }}>
          <Txt variant="title" style={{ textAlign: 'center' }}>{t('rider.pendingTitle')}</Txt>
          <Txt variant="muted" style={{ textAlign: 'center' }}>{t('rider.pendingBody')}</Txt>
        </Stack>
        <Card>
          <Detail label={t('common.name')} value={profile.full_name} />
          <Detail label={t('common.phoneShort')} value={formatPhone(profile.phone)} />
          <Detail label={t('common.plate')} value={application.plate} />
          <Detail label={t('common.district')} value={application.district} />
        </Card>
        <LinkButton title={t('common.signOut')} onPress={signOut} />
        <DeleteAccount />
      </Screen>
    );
  }

  return <Dashboard />;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt variant="muted">{label}</Txt>
      <Txt style={{ fontWeight: '600' }}>{value}</Txt>
    </Row>
  );
}

/** Midnight at the start of the day `daysAgo` days before today, in local time. */
function dayStart(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

type CallRow = { stars: number | null; created_at: string };

/** Calls today, calls in the last 7 days, which of those days had calls (oldest first), and the rating. */
function summarize(rows: CallRow[]) {
  const days = Array.from({ length: 7 }, (_, i) => dayStart(6 - i));
  const weekStart = days[0];
  const today = days[6];
  const recent = rows.map((r) => new Date(r.created_at)).filter((d) => d >= weekStart);
  const active = days.map((d, i) => {
    const end = i < 6 ? days[i + 1] : null;
    return recent.some((c) => c >= d && (!end || c < end));
  });
  const rated = rows.filter((r) => r.stars);
  return {
    today: recent.filter((d) => d >= today).length,
    week: recent.length,
    days,
    active,
    rating: rated.length ? ratingLabel(rated.reduce((sum, r) => sum + r.stars!, 0) / rated.length) : null,
    ratingCount: rated.length,
  };
}

function Dashboard() {
  const theme = useTheme();
  const { t, locale, language, setLanguage } = useI18n();
  const { profile, application, refresh, signOut } = useAuth();
  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [area, setArea] = useState<string>(toDistrict(profile?.district));
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string>();
  const [busyUntil, setBusyUntil] = useState<string | null>(profile?.busy_until ?? null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  // The clock is read in handlers and timers only, so rendering stays pure.
  const [now, setNow] = useState(() => Date.now());
  const riderId = profile!.id;
  const busy = online && busyUntil != null && new Date(busyUntil).getTime() > now;
  const [calls, setCalls] = useState<CallRow[]>([]);
  const stats = useMemo(() => summarize(calls), [calls]);
  const code = riderCode(application?.rider_number);
  const letters = t('day.letters').split(',');

  /** Sends the current position (if allowed) and marks the rider as seen now. */
  const ping = useCallback(async () => {
    const pos = await currentPosition();
    setHasLocation(!!pos);
    setCoords(pos);
    const { error: e } = await supabase
      .from('profiles')
      .update({ is_online: true, lat: pos?.lat ?? null, lng: pos?.lng ?? null, last_seen_at: new Date().toISOString() })
      .eq('id', riderId);
    if (e) setError(t(errorKey(e)));
  }, [riderId, t]);

  useEffect(() => {
    if (!online) return;
    const first = setTimeout(ping, 0);
    const timer = setInterval(ping, PING_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [online, ping]);

  async function toggleOnline(next: boolean) {
    setOnline(next);
    setError(undefined);
    if (!next) {
      // Going offline also clears the saved position and any busy time.
      const { error: e } = await supabase
        .from('profiles')
        .update({ is_online: false, lat: null, lng: null, busy_until: null })
        .eq('id', riderId);
      if (e) setError(t(errorKey(e)));
      setHasLocation(null);
      setCoords(null);
      setBusyUntil(null);
    }
    refresh();
  }

  async function setBusy(next: boolean) {
    const at = Date.now();
    const until = next ? new Date(at + BUSY_MINUTES * 60_000).toISOString() : null;
    setNow(at);
    setBusyUntil(until);
    setError(undefined);
    const { error: e } = await supabase.from('profiles').update({ busy_until: until }).eq('id', riderId);
    if (e) setError(t(errorKey(e)));
  }

  // Re-render when the busy time runs out, so the screen switches back to "online" by itself.
  useEffect(() => {
    if (!busy || !busyUntil) return;
    const timer = setTimeout(() => setNow(Date.now()), new Date(busyUntil).getTime() - now + 500);
    return () => clearTimeout(timer);
  }, [busy, busyUntil, now]);

  // The driver's call log (drivers can read their own calls), for the week, today's figures and the rating.
  const loadStats = useCallback(async () => {
    const { data } = await supabase.from('calls').select('stars, created_at').eq('rider_id', riderId);
    setCalls((data as CallRow[] | null) ?? []);
  }, [riderId]);

  useEffect(() => {
    const first = setTimeout(loadStats, 0);
    const timer = setInterval(loadStats, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [loadStats]);

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    setSavingPhoto(true);
    setError(undefined);
    try {
      await uploadRiderPhoto(riderId, result.assets[0], profile?.photo_path ?? null);
      await refresh();
    } catch (e) {
      console.warn('photo upload failed', e);
      setError(t(errorKey(e)));
    } finally {
      setSavingPhoto(false);
    }
  }

  const mapData = useMemo<LiveMapData>(() => ({ me: coords ? { ...coords, label: t('map.you') } : null, riders: [] }), [coords, t]);

  async function changeArea(next: string) {
    setArea(next);
    const { error: e } = await supabase.from('profiles').update({ district: next }).eq('id', riderId);
    if (e) setError(t(errorKey(e)));
  }

  function nextLanguage() {
    const i = LANGUAGES.findIndex((l) => l.id === language);
    setLanguage(LANGUAGES[(i + 1) % LANGUAGES.length].id);
  }

  const activeDays = stats.active.filter(Boolean).length;
  // Status card colours: green online, orange busy, grey offline.
  const status = busy
    ? { bg: theme.warningSoft, fg: theme.warning }
    : online
      ? { bg: theme.successSoft, fg: theme.success }
      : { bg: theme.backgroundElement, fg: theme.text };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Top bar: photo, name and Jareeye number, language */}
      <View style={[styles.bar, { borderBottomColor: theme.border }]}>
        <Row gap={Spacing.three} style={styles.barInner}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('rider.changePhoto')} onPress={changePhoto} hitSlop={6}>
            <RiderAvatar name={profile!.full_name} photoPath={profile!.photo_path} size={40} round />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt style={styles.barName} numberOfLines={1}>{profile!.full_name}</Txt>
            <Txt variant="muted" style={{ fontSize: 13 }} numberOfLines={1}>
              {[code, application!.plate].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.language')}
            onPress={nextLanguage}
            hitSlop={6}
            style={[styles.lang, { borderColor: theme.border }]}>
            <Txt style={[styles.langCode, { color: theme.brand }]}>{language === 'ar' ? 'ع' : language.toUpperCase()}</Txt>
          </Pressable>
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Spacing.five }} keyboardShouldPersistTaps="handled">
        {/* Online switch first: it's what drivers check on the road */}
        <Section>
          <View style={[styles.status, { backgroundColor: status.bg }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={[styles.statusTitle, { color: status.fg }]}>
                {t(busy ? 'rider.busyTitle' : online ? 'rider.onlineTitle' : 'rider.offlineTitle')}
              </Txt>
              <Txt variant="muted" style={styles.statusBody}>
                {busy
                  ? t('rider.busyBody', { time: new Date(busyUntil!).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
                  : online
                    ? t('rider.onlineBody', { phone: formatPhone(profile!.phone) })
                    : t('rider.offlineBody')}
              </Txt>
              {online && hasLocation !== null ? (
                <Txt style={[styles.statusBody, { fontWeight: '700', color: status.fg }]}>
                  {t(hasLocation ? 'rider.locationShared' : 'rider.locationDenied')}
                </Txt>
              ) : null}
            </View>
            <Switch
              value={online}
              onValueChange={toggleOnline}
              accessibilityLabel={t('rider.online')}
              trackColor={{ false: theme.border, true: theme.success }}
              thumbColor="#FFFFFF"
            />
          </View>
          {online ? (
            busy ? (
              <Button title={t('rider.goFree')} onPress={() => setBusy(false)} />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setBusy(true)}
                style={({ pressed }) => [styles.busyBtn, { borderColor: theme.gold, opacity: pressed ? 0.7 : 1 }]}>
                <Txt style={[styles.busyText, { color: theme.gold }]}>{t('rider.goBusy')}</Txt>
              </Pressable>
            )
          ) : null}
          {error ? <Txt color="danger">{error}</Txt> : null}
        </Section>

        {/* Your week: the last 7 days, filled where you got calls */}
        <Section>
          <View>
            <Txt variant="heading">{t('rider.weekTitle')}</Txt>
            <Txt variant="muted" style={{ fontSize: 13 }}>{t('rider.weekHint')}</Txt>
          </View>
          <Row gap={Spacing.two}>
            <View style={styles.streak}>
              <Icon source={Icons.flame} size={26} color={theme.brand} />
              <Txt style={[styles.streakText, { color: theme.brand }]}>{t('rider.weekDays', { n: activeDays })}</Txt>
            </View>
            <Row gap={0} style={styles.days}>
              {stats.days.map((d, i) => {
                const on = stats.active[i];
                const isToday = i === 6;
                return (
                  <View key={d.toISOString()} style={styles.day}>
                    <Txt variant="muted" style={styles.dayLetter}>{letters[d.getDay()]}</Txt>
                    <View
                      style={[
                        styles.dayDot,
                        on
                          ? { backgroundColor: theme.text, borderColor: theme.text }
                          : { borderColor: isToday ? theme.brand : theme.border },
                      ]}>
                      {on ? (
                        <Icon source={Icons.motorbike} size={18} color={theme.background} />
                      ) : (
                        <Txt style={[styles.dayNum, { color: isToday ? theme.brand : theme.text }]}>{d.getDate()}</Txt>
                      )}
                    </View>
                  </View>
                );
              })}
            </Row>
          </Row>
        </Section>

        {/* Today's figures and a tip */}
        <Section>
          <Txt variant="title">{t('rider.today')}</Txt>
          <Stats
            items={[
              { label: t('rider.statCallsShort'), value: String(stats.today) },
              { label: t('rider.statWeek'), value: String(stats.week) },
              { label: t('rider.statRating'), value: stats.rating ? `★ ${stats.rating}` : t('rating.new') },
            ]}
          />
          <Callout icon={Icons.award} body={t('rider.tips')} />
        </Section>

        <Section band={false}>
          {profile!.photo_path ? null : (
            <Card>
              <Txt variant="heading">{t('rider.addPhotoTitle')}</Txt>
              <Txt variant="muted">{t('rider.addPhotoBody')}</Txt>
              <Button title={t('rider.addPhoto')} kind="ghost" onPress={changePhoto} loading={savingPhoto} />
            </Card>
          )}

          {online && coords && !inCity(coords) ? (
            <Card tone="soft">
              <Txt>{t('area.outsideRider', { city: t(`city.${ACTIVE_CITY.id}` as TKey) })}</Txt>
            </Card>
          ) : null}

          {online && coords && inCity(coords) ? <LiveMap data={mapData} height={220} /> : null}

          <Choices label={t('rider.currentArea')} options={AREA_OPTIONS} value={area} onChange={changeArea} columns={2} />

          {profile!.photo_path ? <LinkButton title={savingPhoto ? t('common.saving') : t('rider.changePhoto')} onPress={changePhoto} /> : null}

          <LinkButton title={t('common.signOut')} onPress={signOut} />
          <DeleteAccount />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  barInner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  barName: { fontSize: 16, fontWeight: '700' },
  lang: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  langCode: { fontSize: 14, fontWeight: '800' },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.large - 4, padding: Spacing.three },
  statusTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  statusBody: { fontSize: 13, lineHeight: 18 },
  busyBtn: { minHeight: 50, borderRadius: Radius.medium, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  busyText: { fontSize: 16, fontWeight: '700' },
  streak: { alignItems: 'center', minWidth: 52, gap: 2 },
  streakText: { fontSize: 12, fontWeight: '700' },
  days: { flex: 1, justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dayLetter: { fontSize: 12 },
  dayDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 13, fontWeight: '600' },
});
