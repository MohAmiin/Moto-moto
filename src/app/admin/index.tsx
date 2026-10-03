import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ConnectionBanner } from '@/components/connection-banner';
import { LiveMap, type LiveMapData } from '@/components/live-map';
import { riderPoints } from '@/components/live-map/points';
import { RiderAvatar } from '@/components/rider-avatar';
import { RiderCard } from '@/components/rider-card';
import { Button, Card, Choices, Empty, Field, Header, LanguageSwitcher, LinkButton, Pill, Row, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { telUrl } from '@/lib/call-log';
import { formatPhone } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { ratingLabel, riderCode } from '@/lib/rider';
import { errorKey, supabase } from '@/lib/supabase';
import type { ApplicationStatus, NearbyRider, RiderApplication } from '@/lib/types';

type Application = RiderApplication & {
  profile: {
    full_name: string;
    phone: string | null;
    photo_path: string | null;
  } | null;
  photoUrl?: string;
};
/** A row from admin_pin_reset_requests(). */
type PinReset = {
  id: string;
  phone: string;
  created_at: string;
  expires_at: string;
  checks_left: number;
  open_for_number: number;
  full_name: string | null;
  role: string | null;
  photo_path: string | null;
  rider_number: number | null;
};
/** Call taps and ratings (one per customer) per rider. */
type Stats = Record<string, { taps: number; stars: number; ratings: number }>;
/** What happened after a code was typed, shown on that card. */
type CodeResult = { outcome: string; checks_left: number };

const TABS = ['pending', 'approved', 'rejected', 'online', 'resets'] as const;
type Tab = (typeof TABS)[number];

export default function Admin() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [online, setOnline] = useState<NearbyRider[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [resets, setResets] = useState<PinReset[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [apps, riders, taps, ratings, pinResets] = await Promise.all([
        supabase
          .from('rider_applications')
          .select('*, profile:profiles!rider_applications_user_id_fkey(full_name, phone, photo_path)')
          .order('created_at', { ascending: false }),
        supabase.rpc('nearby_riders', { p_lat: null, p_lng: null, p_area: null }),
        supabase.from('calls').select('rider_id'),
        supabase.from('rider_ratings').select('rider_id, stars'),
        supabase.rpc('admin_pin_reset_requests'),
      ]);
      // Keep what is on screen when a refresh fails; say so instead of showing empty lists.
      if (apps.error || riders.error || taps.error || ratings.error || pinResets.error) {
        setLoadFailed(true);
        return;
      }
      const next: Stats = {};
      for (const c of (taps.data as { rider_id: string }[]) ?? []) {
        (next[c.rider_id] ??= { taps: 0, stars: 0, ratings: 0 }).taps += 1;
      }
      for (const r of (ratings.data as { rider_id: string; stars: number }[]) ?? []) {
        const s = (next[r.rider_id] ??= { taps: 0, stars: 0, ratings: 0 });
        s.stars += r.stars;
        s.ratings += 1;
      }
      const rows = (apps.data as Application[]) ?? [];
      // ID photos live in a private bucket; signed links expire after an hour.
      const withPhotos = await Promise.all(
        rows.map(async (a) => {
          if (!a.id_photo_path || a.status !== 'pending') return a;
          const { data } = await supabase.storage.from('rider-ids').createSignedUrl(a.id_photo_path, 3600);
          return { ...a, photoUrl: data?.signedUrl };
        }),
      );
      setStats(next);
      setResets((pinResets.data as PinReset[]) ?? []);
      setApplications(withPhotos);
      setOnline((riders.data as NearbyRider[]) ?? []);
      setLoaded(true);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const channel = supabase
      .channel('admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_applications' }, () => load())
      .subscribe();
    const timer = setInterval(load, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [load]);

  async function review(userId: string, approve: boolean) {
    setBusy(userId);
    setError(undefined);
    const { error: e } = await supabase.rpc('review_rider', { p_user_id: userId, p_approve: approve });
    setBusy(null);
    if (e) setError(t(errorKey(e)));
    else load();
  }

  async function confirmPhone(userId: string, code: string): Promise<CodeResult | null> {
    setBusy(userId);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('admin_confirm_rider_phone', { p_user_id: userId, p_code: code });
    setBusy(null);
    if (e) {
      setError(t(errorKey(e)));
      return null;
    }
    load();
    return (data as CodeResult[] | null)?.[0] ?? null;
  }

  async function verifyReset(id: string, code: string): Promise<CodeResult | null> {
    setBusy(id);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('admin_verify_pin_reset', { p_id: id, p_code: code });
    setBusy(null);
    if (e) {
      setError(t(errorKey(e)));
      return null;
    }
    const result = (data as CodeResult[] | null)?.[0] ?? null;
    if (result?.outcome !== 'wrong_code') load();
    return result;
  }

  async function rejectReset(id: string) {
    setBusy(id);
    setError(undefined);
    const { error: e } = await supabase.rpc('admin_reject_pin_reset', { p_id: id });
    setBusy(null);
    if (e) setError(t(errorKey(e)));
    else load();
  }

  const mapData = useMemo<LiveMapData>(() => ({ me: null, riders: riderPoints(online, t) }), [online, t]);

  const count = (s: ApplicationStatus) => applications.filter((a) => a.status === s).length;
  const tabs = TABS.map((id) => ({
    id,
    label: `${t(`admin.${id}` as TKey)} (${id === 'online' ? online.length : id === 'resets' ? resets.length : count(id)})`,
  }));

  return (
    <Screen>
      <LanguageSwitcher />
      <Header title={t('admin.title')} subtitle={t('admin.sub')} back={false} />
      {loadFailed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}
      <Choices options={tabs} value={tab} onChange={setTab} columns={3} />
      {error ? (
        <Txt color="danger" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}

      {!loaded ? (
        loadFailed ? null : <Empty title={t('common.loading')} />
      ) : tab === 'resets' ? (
        <ResetList items={resets} busy={busy} onVerify={verifyReset} onReject={rejectReset} />
      ) : tab === 'online' ? (
        <>
          <LiveMap data={mapData} height={320} />
          {online.length === 0 ? <Empty title={t('admin.noOnline')} /> : online.map((r) => <RiderCard key={r.id} rider={r} />)}
        </>
      ) : (
        <ApplicationList
          items={applications.filter((a) => a.status === tab)}
          stats={tab === 'approved' ? stats : undefined}
          busy={busy}
          onReview={tab === 'pending' ? review : undefined}
          onConfirmPhone={tab === 'pending' ? confirmPhone : undefined}
        />
      )}

      <LinkButton title={t('common.signOut')} onPress={signOut} />
    </Screen>
  );
}

/** A rider's application is verified for their current number. Mirrors review_rider in the database. */
function phoneConfirmed(a: Application) {
  return a.phone_verified_at != null && a.profile?.phone != null && a.phone_verified_number === a.profile.phone;
}

function ApplicationList({
  items,
  stats,
  busy,
  onReview,
  onConfirmPhone,
}: {
  items: Application[];
  stats?: Stats;
  busy: string | null;
  onReview?: (userId: string, approve: boolean) => void;
  onConfirmPhone?: (userId: string, code: string) => Promise<CodeResult | null>;
}) {
  const { t, locale } = useI18n();
  if (items.length === 0) return <Empty title={t('admin.noApplications')} />;
  return items.map((a) => {
    const s = stats?.[a.user_id];
    const code = riderCode(a.rider_number);
    const confirmed = phoneConfirmed(a);
    return (
      <Card key={a.user_id}>
        <Row gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
          <RiderAvatar name={a.profile?.full_name ?? '?'} photoPath={a.profile?.photo_path} size={64} />
          {a.photoUrl ? (
            <Image source={{ uri: a.photoUrl }} style={styles.photo} contentFit="cover" accessibilityLabel={t('admin.idPhoto')} />
          ) : null}
          <Stack gap={2} style={{ flex: 1 }}>
            <Txt variant="heading">{a.profile?.full_name ?? '—'}</Txt>
            {code ? <Txt style={{ fontWeight: '700' }}>{code}</Txt> : null}
            {stats ? (
              <Txt variant="muted">
                {t('admin.stats', {
                  calls: s?.taps ?? 0,
                  rating: s?.ratings
                    ? t('rating.value', { rating: ratingLabel(s.stars / s.ratings)!, count: s.ratings })
                    : t('admin.noRating'),
                })}
              </Txt>
            ) : null}
            <Txt variant="muted">{formatPhone(a.profile?.phone)}</Txt>
            <Txt variant="muted">{t('admin.idLine', { id: a.id_number ?? '—', plate: a.plate })}</Txt>
            <Txt variant="muted">
              {t('admin.districtLine', { d: a.district, date: new Date(a.created_at).toLocaleDateString(locale) })}
            </Txt>
            {onReview ? (
              <Pill
                tone={confirmed ? 'success' : 'warning'}
                label={
                  confirmed
                    ? t('admin.phoneVerified', { date: new Date(a.phone_verified_at!).toLocaleDateString(locale) })
                    : t('admin.phoneUnverified')
                }
              />
            ) : null}
          </Stack>
        </Row>
        {onConfirmPhone && !confirmed && a.profile?.phone ? (
          <CodeEntry
            hint={t('admin.verifyHint')}
            phone={a.profile.phone}
            label={t('admin.riderCode')}
            action={t('admin.confirmPhone')}
            busy={busy === a.user_id}
            onSubmit={(c) => onConfirmPhone(a.user_id, c)}
            messages={{ no_code: 'admin.noRiderCode', failed: 'admin.riderCodeFailed', expired: 'admin.codeExpired' }}
          />
        ) : null}
        {onReview ? (
          <View style={styles.actions}>
            <Button
              title={t('admin.approve')}
              onPress={() => onReview(a.user_id, true)}
              loading={busy === a.user_id}
              disabled={!confirmed}
              style={{ flex: 1 }}
            />
            <Button
              title={t('admin.reject')}
              kind="danger"
              onPress={() => onReview(a.user_id, false)}
              disabled={busy === a.user_id}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}
      </Card>
    );
  });
}

/**
 * Call the number, type the 6-digit code the person reads out, and submit. Shows what happened
 * (wrong code with tries left, expired, used up) on the card itself.
 */
function CodeEntry({
  hint,
  phone,
  label,
  action,
  busy,
  onSubmit,
  messages,
}: {
  hint: string;
  phone: string;
  label: string;
  action: string;
  busy: boolean;
  onSubmit: (code: string) => Promise<CodeResult | null>;
  messages: Partial<Record<string, TKey>>;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string>();

  async function submit() {
    const r = await onSubmit(code);
    if (!r) return;
    setCode('');
    if (r.outcome === 'wrong_code') setResult(t('admin.wrongCode', { n: r.checks_left }));
    else {
      const key = messages[r.outcome];
      setResult(key ? t(key) : undefined);
    }
  }

  return (
    <Stack gap={Spacing.two}>
      <Txt variant="muted">{hint}</Txt>
      <Button title={`${t('admin.callNow')} ${formatPhone(phone)}`} kind="ghost" onPress={() => Linking.openURL(telUrl(phone))} />
      <Field
        label={label}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        error={result}
        style={styles.code}
      />
      <Button title={action} onPress={submit} loading={busy} disabled={code.length !== 6} />
    </Stack>
  );
}

/** PIN reset requests: call the account's number, ask for the code on the owner's screen, type it in. */
function ResetList({
  items,
  busy,
  onVerify,
  onReject,
}: {
  items: PinReset[];
  busy: string | null;
  onVerify: (id: string, code: string) => Promise<CodeResult | null>;
  onReject: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const [done, setDone] = useState<string>();
  if (items.length === 0) {
    return done ? (
      <Card tone="soft">
        <Txt style={{ fontWeight: '700' }}>{done}</Txt>
      </Card>
    ) : (
      <Empty title={t('admin.noResets')} />
    );
  }
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      {done ? (
        <Card tone="soft">
          <Txt style={{ fontWeight: '700' }}>{done}</Txt>
        </Card>
      ) : null}
      {items.map((r) => {
        const name = r.full_name ?? formatPhone(r.phone);
        return (
          <Card key={r.id}>
            <Row gap={Spacing.three} style={{ alignItems: 'flex-start' }}>
              <RiderAvatar name={name} photoPath={r.photo_path} size={56} />
              <Stack gap={2} style={{ flex: 1 }}>
                <Txt variant="heading">{name}</Txt>
                <Txt style={{ fontWeight: '700' }}>{riderCode(r.rider_number) ?? t('admin.customer')}</Txt>
                <Txt variant="muted">{formatPhone(r.phone)}</Txt>
                <Txt variant="muted">{t('admin.resetLine', { date: new Date(r.created_at).toLocaleString(locale) })}</Txt>
                <Txt variant="muted">{t('admin.resetExpires', { time: time(r.expires_at) })}</Txt>
              </Stack>
            </Row>
            {r.open_for_number > 1 ? <Pill tone="warning" label={t('admin.resetMany', { n: r.open_for_number })} /> : null}
            <CodeEntry
              hint={t('admin.resetHint')}
              phone={r.phone}
              label={t('admin.resetCode')}
              action={t('admin.resetVerify')}
              busy={busy === r.id}
              onSubmit={async (c) => {
                const result = await onVerify(r.id, c);
                if (result?.outcome === 'approved') setDone(t('admin.resetDone'));
                return result;
              }}
              messages={{ failed: 'admin.codeFailed', expired: 'admin.codeExpired', not_open: 'admin.notOpen' }}
            />
            <Button title={t('admin.reject')} kind="danger" onPress={() => onReject(r.id)} disabled={busy === r.id} />
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  photo: { width: 96, height: 64, borderRadius: Radius.small },
  actions: { flexDirection: 'row', gap: Spacing.two },
  code: { fontSize: 22, letterSpacing: 6, textAlign: 'center', writingDirection: 'ltr', fontWeight: '700' },
});
