import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Empty, Header, Loading, Monogram, Row, Screen, Stepper, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCart } from '@/lib/cart';
import { money } from '@/lib/somali';
import { supabase } from '@/lib/supabase';
import type { Product, Store } from '@/lib/types';

export default function StoreScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cart = useCart();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    Promise.all([
      supabase.from('stores').select('*').eq('id', id).single<Store>(),
      supabase.from('products').select('*').eq('store_id', id).eq('is_available', true).order('sort_order'),
    ]).then(([s, p]) => {
      setStore(s.data ?? null);
      setProducts((p.data as Product[]) ?? []);
    });
  }, [id]);

  if (!store) return <Loading />;

  const inThisStore = cart.store?.id === store.id;

  return (
    <Screen
      footer={
        inThisStore && cart.count > 0 ? (
          <Button title={`Eeg dambiisha · ${cart.count} · ${money(cart.subtotal)}`} onPress={() => router.push('/cart')} />
        ) : null
      }>
      <Header title={store.name} subtitle={`${store.eta_label} daqiiqo · Geyn $1`} />
      <Row gap={Spacing.three}>
        <Monogram name={store.name} size={64} />
        <Txt variant="muted" style={{ flex: 1 }}>{store.description}</Txt>
      </Row>
      {notice ? <Txt color="warning">{notice}</Txt> : null}
      {products.length === 0 ? <Empty title="Weli alaab lama gelin" /> : null}
      {products.map((p) => (
        <View key={p.id} style={[styles.item, { borderColor: theme.border }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: '700', fontSize: 16 }}>{p.name}</Txt>
            {p.description ? <Txt variant="muted">{p.description}</Txt> : null}
            <Txt variant="price">{money(p.price)}</Txt>
          </View>
          <Stepper
            quantity={inThisStore ? cart.quantityOf(p.id) : 0}
            onAdd={() => {
              if (cart.add(store, p)) setNotice('Dambiishii hore waa la faaruqiyay. Hal meel ayaa laga dalban karaa markiiba.');
            }}
            onRemove={() => cart.remove(p.id)}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
});
