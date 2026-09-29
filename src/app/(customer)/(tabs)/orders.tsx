import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Empty, Header, Monogram, Pill, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { money, packageKey, statusKey } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

type Row = Order & { stores: { name: string } | null };

export default function Orders() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('orders')
        .select('*, stores(name)')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setOrders((data as Row[]) ?? []);
          setLoaded(true);
        });
    }, []),
  );

  return (
    <Screen edges={['top']}>
      <Header title={t('orders.title')} back={false} />
      {loaded && orders.length === 0 ? <Empty title={t('orders.empty')} body={t('orders.emptyBody')} /> : null}
      {orders.map((o) => {
        const title =
          o.kind === 'store'
            ? (o.stores?.name ?? t('common.store'))
            : `${t(packageKey(o.package_type))} · ${t('common.route', { from: o.pickup_district, to: o.dropoff_district })}`;
        const tone = o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'neutral' : 'brand';
        return (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/order/${o.id}`)}>
            <View style={[styles.row, { borderColor: theme.border }]}>
              <Monogram name={o.kind === 'store' ? title : t(packageKey(o.package_type))} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={{ fontWeight: '700' }}>{title}</Txt>
                <Txt variant="muted">
                  #{o.id} · {new Date(o.created_at).toLocaleDateString(locale)} · {money(Number(o.items_total) + Number(o.delivery_fee))}
                </Txt>
              </View>
              <Pill label={t(statusKey(o.status))} tone={tone} />
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
});
