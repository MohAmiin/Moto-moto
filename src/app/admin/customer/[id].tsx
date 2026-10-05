import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, View } from 'react-native';

import { PhoneCorrection } from '@/components/admin/phone-correction';
import { AdminButton, AdminScreen, DetailBar, EmptyNote, InfoLine, Panel, SectionTitle } from '@/components/kit';
import { ConnectionBanner } from '@/components/connection-banner';
import { Monogram, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAdminRefresh, usePullToRefresh, type CustomerRow } from '@/lib/admin';
import { telUrl } from '@/lib/call-log';
import { formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type Usage = { taps: number; ratings: number; lastCall: string | null };

/** A customer's account details and how they use Jareeye (Call taps and ratings). */
export default function CustomerDetail() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerRow | null>();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    const [p, taps, last, ratings] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, district, created_at').eq('id', id).eq('role', 'customer').maybeSingle(),
      supabase.from('calls').select('id', { count: 'exact', head: true }).eq('caller_id', id),
      supabase.from('calls').select('created_at').eq('caller_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('rider_ratings').select('rider_id', { count: 'exact', head: true }).eq('customer_id', id),
    ]);
    setRefreshing(false);
    if (p.error || taps.error || last.error || ratings.error) {
      setFailed(true);
      setCustomer((prev) => (prev === undefined ? null : prev));
      return;
    }
    setCustomer((p.data as CustomerRow | null) ?? null);
    setUsage({
      taps: taps.count ?? 0,
      ratings: ratings.count ?? 0,
      lastCall: ((last.data as { created_at: string }[]) ?? [])[0]?.created_at ?? null,
    });
    setFailed(false);
  }, [id]);

  useAdminRefresh(load, `admin-customer-${id}`);
  const pull = usePullToRefresh(load);

  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null);

  return (
    <AdminScreen
      edges={['top', 'bottom']}
      header={<DetailBar title={customer?.full_name || t('admin.customer')} />}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={theme.textSecondary} />}>
      {failed ? <ConnectionBanner message={t('admin.loadFailed')} onRetry={load} retrying={refreshing} /> : null}
      {customer === undefined ? (
        <Panel>
          <EmptyNote icon="customers" title={t('common.loading')} />
        </Panel>
      ) : customer === null ? (
        failed ? null : (
          <Panel>
            <EmptyNote icon="customers" title={t('adm.customerMissing')} />
          </Panel>
        )
      ) : (
        <>
          <Panel>
            <View style={styles.head}>
              <Monogram name={customer.full_name || '?'} size={56} radius={28} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={styles.name}>{customer.full_name || '—'}</Txt>
                <Txt variant="muted" style={styles.small}>
                  {formatPhone(customer.phone)}
                </Txt>
              </View>
            </View>
            {customer.phone ? (
              <AdminButton title={t('admin.callNow')} kind="outline" icon="phone" onPress={() => Linking.openURL(telUrl(customer.phone!))} />
            ) : null}
          </Panel>

          <SectionTitle title={t('adm.details')} />
          <Panel>
            <InfoLine label={t('common.district')} value={customer.district} />
            <InfoLine label={t('adm.joinedLabel')} value={date(customer.created_at)} last />
          </Panel>
          <PhoneCorrection userId={customer.id} isRider={false} onChanged={load} />

          {usage ? (
            <>
              <SectionTitle title={t('adm.activity')} />
              <Panel>
                <InfoLine label={t('adm.callTaps')} value={String(usage.taps)} />
                <InfoLine label={t('adm.lastCall')} value={usage.lastCall ? date(usage.lastCall) : t('adm.never')} />
                <InfoLine label={t('adm.ratingsGiven')} value={String(usage.ratings)} last />
              </Panel>
            </>
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  name: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 18 },
});
