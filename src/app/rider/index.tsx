import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { LiveMap, type LiveMapData } from '@/components/live-map';
import { DeleteAccount } from '@/components/delete-account';
import { RiderApplicationForm } from '@/components/rider-application-form';
import { RiderAvatar } from '@/components/rider-avatar';
import { Button, Card, Choices, Header, LanguageSwitcher, LinkButton, Row, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA, formatPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { currentPosition, type Coords } from '@/lib/location';
import { riderCode, uploadRiderPhoto } from '@/lib/rider';
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

function Dashboard() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { profile, application, refresh, signOut } = useAuth();
  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [area, setArea] = useState<string>(profile?.district ?? DEFAULT_AREA);
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string>();
  const [busyUntil, setBusyUntil] = useState<string | null>(profile?.busy_until ?? null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  // The clock is read in handlers and timers only, so rendering stays pure.
  const [now, setNow] = useState(() => Date.now());
  const riderId = profile!.id;
  const busy = online && busyUntil != null && new Date(busyUntil).getTime() > now;
  const code = riderCode(application?.rider_number);

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

  return (
    <Screen>
      <View style={[styles.head, { backgroundColor: online ? theme.gold : theme.text }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={Spacing.three} style={{ flex: 1 }}>
            <RiderAvatar name={profile!.full_name} photoPath={profile!.photo_path} size={48} />
            <View style={{ flex: 1 }}>
              <Txt variant="heading" style={{ color: online ? theme.onGold : theme.background }}>{profile!.full_name}</Txt>
              <Txt style={{ color: online ? theme.onGold : theme.background, opacity: 0.75, fontSize: 13 }}>
                {[code, application!.plate, formatPhone(profile!.phone)].filter(Boolean).join(' · ')}
              </Txt>
            </View>
          </Row>
          <Row>
            <Txt style={{ color: online ? theme.onGold : theme.background, fontWeight: '800' }}>
              {t(online ? 'rider.online' : 'rider.offline')}
            </Txt>
            <Switch value={online} onValueChange={toggleOnline} accessibilityLabel={t('rider.online')} />
          </Row>
        </Row>
        <Txt variant="title" style={{ color: online ? theme.onGold : theme.background }}>
          {t(busy ? 'rider.busyTitle' : online ? 'rider.onlineTitle' : 'rider.offlineTitle')}
        </Txt>
        <Txt style={{ color: online ? theme.onGold : theme.background, opacity: 0.85 }}>
          {busy
            ? t('rider.busyBody', { time: new Date(busyUntil!).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
            : online
              ? t('rider.onlineBody', { phone: formatPhone(profile!.phone) })
              : t('rider.offlineBody')}
        </Txt>
        {online && hasLocation !== null ? (
          <Txt style={{ color: theme.onGold, fontWeight: '700' }}>{t(hasLocation ? 'rider.locationShared' : 'rider.locationDenied')}</Txt>
        ) : null}
      </View>

      {online ? (
        busy ? (
          <Button title={t('rider.goFree')} onPress={() => setBusy(false)} />
        ) : (
          <Button title={t('rider.goBusy')} kind="ghost" onPress={() => setBusy(true)} />
        )
      ) : null}

      {error ? <Txt color="danger">{error}</Txt> : null}

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

      <Card tone="soft">
        <Txt>{t('rider.tips')}</Txt>
      </Card>

      {profile!.photo_path ? <LinkButton title={savingPhoto ? t('common.saving') : t('rider.changePhoto')} onPress={changePhoto} /> : null}

      <LanguageSwitcher />
      <LinkButton title={t('common.signOut')} onPress={signOut} />
      <DeleteAccount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
});
