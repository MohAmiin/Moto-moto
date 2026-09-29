import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { LiveMap, type LiveMapData } from '@/components/live-map';
import { RiderApplicationForm } from '@/components/rider-application-form';
import { Card, Choices, Header, LanguageSwitcher, LinkButton, Row, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA, formatPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { currentPosition, type Coords } from '@/lib/location';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { errorKey, supabase } from '@/lib/supabase';

// While online, refresh the rider's position and "last seen" so people see who is really available.
const PING_MS = 30_000;

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
  const { t } = useI18n();
  const { profile, application, refresh, signOut } = useAuth();
  const [online, setOnline] = useState(profile?.is_online ?? false);
  const [area, setArea] = useState<string>(profile?.district ?? DEFAULT_AREA);
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string>();
  const riderId = profile!.id;

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
      // Going offline also clears the saved position.
      const { error: e } = await supabase.from('profiles').update({ is_online: false, lat: null, lng: null }).eq('id', riderId);
      if (e) setError(t(errorKey(e)));
      setHasLocation(null);
      setCoords(null);
    }
    refresh();
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
          <View style={{ flex: 1 }}>
            <Txt variant="heading" style={{ color: online ? theme.onGold : theme.background }}>{profile!.full_name}</Txt>
            <Txt style={{ color: online ? theme.onGold : theme.background, opacity: 0.75, fontSize: 13 }}>
              {application!.plate} · {formatPhone(profile!.phone)}
            </Txt>
          </View>
          <Row>
            <Txt style={{ color: online ? theme.onGold : theme.background, fontWeight: '800' }}>
              {t(online ? 'rider.online' : 'rider.offline')}
            </Txt>
            <Switch value={online} onValueChange={toggleOnline} accessibilityLabel={t('rider.online')} />
          </Row>
        </Row>
        <Txt variant="title" style={{ color: online ? theme.onGold : theme.background }}>
          {t(online ? 'rider.onlineTitle' : 'rider.offlineTitle')}
        </Txt>
        <Txt style={{ color: online ? theme.onGold : theme.background, opacity: 0.85 }}>
          {online ? t('rider.onlineBody', { phone: formatPhone(profile!.phone) }) : t('rider.offlineBody')}
        </Txt>
        {online && hasLocation !== null ? (
          <Txt style={{ color: theme.onGold, fontWeight: '700' }}>{t(hasLocation ? 'rider.locationShared' : 'rider.locationDenied')}</Txt>
        ) : null}
      </View>

      {error ? <Txt color="danger">{error}</Txt> : null}

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

      <LanguageSwitcher />
      <LinkButton title={t('common.signOut')} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
});
