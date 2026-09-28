import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Empty, Header, Monogram, Pill, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STATUS_SHORT, money, packageLabel } from '@/lib/somali';
import { supabase } from '@/lib/supabase';
import type { Order } from '@/lib/types';

type Row = Order & { stores: { name: string } | null };

export default function Orders() {
  const theme = useTheme();
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
      <Header title="Dalabyadayda" back={false} />
      {loaded && orders.length === 0 ? <Empty title="Weli dalab ma samaysan" body="Dalabyadaada halkan ayay ka muuqan doonaan." /> : null}
      {orders.map((o) => {
        const title = o.kind === 'store' ? (o.stores?.name ?? 'Dukaan') : `${packageLabel(o.package_type)} · ${o.pickup_district} → ${o.dropoff_district}`;
        const tone = o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'neutral' : 'brand';
        return (
          <Pressable key={o.id} accessibilityRole="button" onPress={() => router.push(`/order/${o.id}`)}>
            <View style={[styles.row, { borderColor: theme.border }]}>
              <Monogram name={o.kind === 'store' ? title : 'Xirmo'} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={{ fontWeight: '700' }}>{title}</Txt>
                <Txt variant="muted">
                  #{o.id} · {new Date(o.created_at).toLocaleDateString()} · {money(Number(o.items_total) + Number(o.delivery_fee))}
                </Txt>
              </View>
              <Pill label={STATUS_SHORT[o.status]} tone={tone} />
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
