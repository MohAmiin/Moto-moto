import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AdminButton, AdminScreen, DetailBar, Notice, Panel, TextField } from '@/components/kit';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n, type TKey } from '@/lib/i18n';
import { currentLocation, type Coords } from '@/lib/location';
import { createMotoRequest, kmBetween, requestErrorKey, shortKm } from '@/lib/requests';
import { ACTIVE_CITY, inCity } from '@/lib/service-area';
import { supabase } from '@/lib/supabase';

const NOTE_MAX = 140;

/** Request a moto: pickup (starts at your location), drop-off (tap the map), a short note, send. */
export default function NewRequest() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile } = useAuth();
  const [pickup, setPickup] = useState<Coords | null>(null);
  const [dropoff, setDropoff] = useState<Coords | null>(null);
  const [picking, setPicking] = useState<'pickup' | 'dropoff'>('dropoff');
  const [pickupLabel, setPickupLabel] = useState(profile?.district ?? '');
  const [dropoffLabel, setDropoffLabel] = useState('');
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<TKey | null>(null);

  // A customer with an open request goes straight to it.
  useEffect(() => {
    let active = true;
    supabase.rpc('my_moto_request').then(async ({ data }) => {
      if (!active || !data) return;
      const detail = await supabase.rpc('moto_request_detail', { p_request_id: data });
      const status = (detail.data as { status: string }[] | null)?.[0]?.status;
      if (active && status && status !== 'delivered') router.replace({ pathname: '/request/[id]', params: { id: data as string } });
    });
    return () => {
      active = false;
    };
  }, []);

  // Start the pickup at your position when it's inside the city; otherwise you place it on the map.
  useEffect(() => {
    let active = true;
    currentLocation().then((r) => {
      if (!active) return;
      setLocating(false);
      if (r.status === 'ok' && inCity(r.coords)) setPickup(r.coords);
      else setPicking('pickup');
    });
    return () => {
      active = false;
    };
  }, []);

  const mapData = useMemo<LiveMapData>(
    () => ({ me: null, riders: [], pickup, dropoff, picking, recenter: pickup && dropoff ? 1 : 0 }),
    [pickup, dropoff, picking],
  );

  function onPick(point: Coords) {
    setError(null);
    if (picking === 'pickup') {
      if (!inCity(point)) {
        setError('rq.errOutside');
        return;
      }
      setPickup(point);
      if (!dropoff) setPicking('dropoff');
    } else {
      setDropoff(point);
    }
  }

  async function send() {
    if (!pickup) return setError('rq.needPickup');
    if (!dropoff) return setError('rq.needDropoff');
    setSending(true);
    setError(null);
    try {
      const id = await createMotoRequest({ pickup, pickupLabel, dropoff, dropoffLabel, note });
      router.replace({ pathname: '/request/[id]', params: { id } });
    } catch (e) {
      setError(requestErrorKey(e));
      setSending(false);
    }
  }

  const trip = pickup && dropoff ? shortKm(kmBetween(pickup, dropoff)) : null;
  const city = t(`city.${ACTIVE_CITY.id}` as TKey);

  return (
    <AdminScreen header={<DetailBar title={t('rq.title')} />}>
      <Panel padded={false}>
        <LiveMap data={mapData} height={260} rounded={false} onPick={onPick} />
      </Panel>
      <Txt variant="muted" style={styles.hint} accessibilityLiveRegion="polite">
        {locating ? t('rq.locating') : picking === 'pickup' ? t('rq.tapPickup', { city }) : t('rq.tapDropoff')}
      </Txt>

      <Panel>
        <StopRow
          kind="pickup"
          active={picking === 'pickup'}
          title={t('rq.pickup')}
          value={pickup ? t('rq.pointSet') : t('rq.notSet')}
          action={t('rq.change')}
          onPress={() => setPicking('pickup')}
        />
        <TextField label={t('rq.pickupPlace')} value={pickupLabel} onChangeText={setPickupLabel} placeholder={t('rq.pickupPlaceHint')} maxLength={80} />
        <View style={[styles.divider, { backgroundColor: theme.hairline }]} />
        <StopRow
          kind="dropoff"
          active={picking === 'dropoff'}
          title={t('rq.dropoff')}
          value={dropoff ? (trip ? t('rq.tripKm', { d: trip }) : t('rq.pointSet')) : t('rq.notSet')}
          action={dropoff ? t('rq.change') : t('rq.set')}
          onPress={() => setPicking('dropoff')}
        />
        <TextField label={t('rq.dropoffPlace')} value={dropoffLabel} onChangeText={setDropoffLabel} placeholder={t('rq.dropoffPlaceHint')} maxLength={80} />
      </Panel>

      <TextField
        label={t('rq.note')}
        value={note}
        onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
        placeholder={t('rq.noteHint')}
        multiline
        maxLength={NOTE_MAX}
        help={t('rq.noteCount', { n: note.length, max: NOTE_MAX })}
      />

      {error ? <Notice icon="attention" tone="danger" title={t(error)} /> : null}
      <Txt variant="muted" style={styles.small}>
        {t('rq.howItWorks')}
      </Txt>
      <AdminButton title={t('rq.send')} kind="accent" icon="delivery" onPress={send} loading={sending} disabled={!pickup || !dropoff} style={styles.send} />
    </AdminScreen>
  );
}

function StopRow({
  kind,
  active,
  title,
  value,
  action,
  onPress,
}: {
  kind: 'pickup' | 'dropoff';
  active: boolean;
  title: string;
  value: string;
  action: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = kind === 'pickup' ? theme.primary : theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}: ${value}. ${action}`}
      onPress={onPress}
      style={({ pressed }) => [styles.stop, active && { backgroundColor: theme.surfaceMuted }, pressed && { opacity: 0.7 }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1, gap: 1 }}>
        <Txt variant="muted" style={styles.label}>
          {title}
        </Txt>
        <Txt style={styles.value}>{value}</Txt>
      </View>
      <Txt style={[styles.action, { color: theme.primaryText }]}>{active ? '●' : action}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 18, marginTop: -Spacing.two },
  stop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, borderRadius: 10, padding: Spacing.two, marginHorizontal: -Spacing.two },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 12, lineHeight: 16 },
  value: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  action: { fontSize: 13, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  small: { fontSize: 13, lineHeight: 18 },
  send: { minHeight: 52 },
});
