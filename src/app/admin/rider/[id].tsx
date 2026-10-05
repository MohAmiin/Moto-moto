import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { CodeEntry } from '@/components/admin/code-entry';
import { PhoneCorrection } from '@/components/admin/phone-correction';
import { RiderMembership } from '@/components/admin/rider-membership';
import { AdminButton, AdminScreen, Badge, DetailBar, EmptyNote, InfoLine, Panel, SectionTitle } from '@/components/kit';
import { ConnectionBanner } from '@/components/connection-banner';
import { RiderAvatar } from '@/components/rider-avatar';
import { Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchApplication, fetchOnlineRiders, onlineLabel, phoneConfirmed, useAdminRefresh, usePullToRefresh, type Application, type CodeResult, type OnlineRider } from '@/lib/admin';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { ratingLabel, riderCode } from '@/lib/rider';
import { errorKey, supabase } from '@/lib/supabase';

type Stats = { taps: number; ratings: number; average: number | null };

/** One rider: details, ID photo, Call taps and rating, and the phone check and approval for pending riders. */
export default function RiderDetail() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [app, setApp] = useState<Application | null>();
  const [idPhoto, setIdPhoto] = useState<string>();
  const [live, setLive] = useState<OnlineRider | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const [a, online, taps, ratings] = await Promise.all([
        fetchApplication(id),
        fetchOnlineRiders(),
        supabase.from('calls').select('id', { count: 'exact', head: true }).eq('rider_id', id),
        supabase.from('rider_ratings').select('stars').eq('rider_id', id),
      ]);
      if (taps.error || ratings.error) throw taps.error ?? ratings.error;
      const stars = ((ratings.data as { stars: number }[]) ?? []).map((r) => r.stars);
      setStats({ taps: taps.count ?? 0, ratings: stars.length, average: stars.length ? stars.reduce((s, x) => s + x, 0) / stars.length : null });
      setLive(online.find((r) => r.id === id) ?? null);
      setApp(a);
      // ID photos are private; a signed link lasts an hour.
      if (a?.id_photo_path) {
        const { data } = await supabase.storage.from('rider-ids').createSignedUrl(a.id_photo_path, 3600);
        setIdPhoto(data?.signedUrl);
      }
      setFailed(false);
    } catch {
      setFailed(true);
      setApp((prev) => (prev === undefined ? null : prev));
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useAdminRefresh(load, `admin-rider-${id}`);
  const pull = usePullToRefresh(load);

  async function review(approve: boolean) {
    setBusy(true);
    setError(undefined);
    const { error: e } = await supabase.rpc('review_rider', { p_user_id: id, p_approve: approve });
    setBusy(false);
    if (e) setError(t(errorKey(e)));
    else load();
  }

  async function confirmPhone(code: string): Promise<CodeResult | null> {
    setBusy(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('admin_confirm_rider_phone', { p_user_id: id, p_code: code });
    setBusy(false);
    if (e) {
      setError(t(errorKey(e)));
      return null;
    }
    load();
    return (data as CodeResult[] | null)?.[0] ?? null;
  }

  const name = app?.profile?.full_name ?? '—';
  const confirmed = app ? phoneConfirmed(app) : false;
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

  return (
    <AdminScreen
      edges={['top', 'bottom']}
      header={<DetailBar title={app ? name : t('adm.rider')} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.textSecondary} />}>
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}

      {app === undefined ? (
        <Panel>
          <EmptyNote icon="riders" title={t('common.loading')} />
        </Panel>
      ) : app === null ? (
        failed ? null : (
          <Panel>
            <EmptyNote icon="riders" title={t('adm.riderMissing')} />
          </Panel>
        )
      ) : (
        <>
          <Panel>
            <View style={styles.head}>
              <RiderAvatar name={name} photoPath={app.profile?.photo_path} size={64} round />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt style={styles.name}>{name}</Txt>
                <Txt variant="muted" style={styles.small}>
                  {[riderCode(app.rider_number), formatPhone(app.profile?.phone)].filter(Boolean).join(' · ')}
                </Txt>
                <View style={styles.badges}>
                  <Badge
                    label={t(app.status === 'pending' ? 'admin.pending' : app.status === 'approved' ? 'admin.approved' : 'admin.rejected')}
                    tone={app.status === 'pending' ? 'accent' : app.status === 'approved' ? 'success' : 'danger'}
                  />
                  {live ? <Badge label={t('adm.reportingOnline')} tone="neutral" /> : null}
                  {live ? <Badge label={t(onlineLabel(live).label)} tone={onlineLabel(live).tone} /> : null}
                </View>
              </View>
            </View>
          </Panel>

          {app.status === 'pending' ? (
            <>
              <SectionTitle title={t('adm.approval')} />
              <Panel>
                <Badge
                  label={confirmed ? t('admin.phoneVerified', { date: date(app.phone_verified_at) ?? '' }) : t('admin.phoneUnverified')}
                  tone={confirmed ? 'success' : 'warning'}
                />
                {!confirmed && app.profile?.phone ? (
                  <CodeEntry
                    hint={t('admin.verifyHint')}
                    phone={app.profile.phone}
                    label={t('admin.riderCode')}
                    action={t('admin.confirmPhone')}
                    busy={busy}
                    onSubmit={confirmPhone}
                    messages={{ no_code: 'admin.noRiderCode', failed: 'admin.riderCodeFailed', expired: 'admin.codeExpired' }}
                  />
                ) : null}
                {error ? (
                  <Txt color="danger" style={styles.small} accessibilityRole="alert">
                    {error}
                  </Txt>
                ) : null}
                <View style={styles.actions}>
                  <AdminButton title={t('admin.reject')} kind="danger" onPress={() => review(false)} disabled={busy} style={{ flex: 1 }} />
                  <AdminButton title={t('admin.approve')} kind="accent" onPress={() => review(true)} loading={busy} disabled={!confirmed} style={{ flex: 1 }} />
                </View>
                {!confirmed ? (
                  <Txt variant="muted" style={styles.small}>
                    {t('adm.approveNeedsPhone')}
                  </Txt>
                ) : null}
              </Panel>
            </>
          ) : null}

          {app.status === 'approved' && stats ? (
            <>
              <SectionTitle title={t('adm.activity')} />
              <Panel>
                <InfoLine label={t('adm.callTaps')} value={String(stats.taps)} />
                <InfoLine
                  label={t('adm.rating')}
                  value={stats.average != null ? t('rating.value', { rating: ratingLabel(stats.average)!, count: stats.ratings }) : t('admin.noRating')}
                  last
                />
              </Panel>
            </>
          ) : null}

          {app.status !== 'rejected' ? <RiderMembership userId={app.user_id} /> : null}

          <SectionTitle title={t('adm.details')} />
          <Panel>
            <InfoLine label={t('common.plate')} value={app.plate} />
            <InfoLine label={t('common.district')} value={app.district} />
            <InfoLine label={t('adm.idNumber')} value={app.id_number} />
            <InfoLine label={t('adm.applied')} value={date(app.created_at)} />
            <InfoLine label={t('adm.reviewed')} value={date(app.reviewed_at)} last />
          </Panel>
          <PhoneCorrection userId={app.user_id} isRider onChanged={load} />

          {idPhoto ? (
            <>
              <SectionTitle title={t('admin.idPhoto')} />
              <Panel padded={false}>
                <Image source={{ uri: idPhoto }} style={styles.idPhoto} contentFit="cover" accessibilityLabel={t('admin.idPhoto')} />
              </Panel>
            </>
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  idPhoto: { width: '100%', aspectRatio: 3 / 2 },
});
