import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Choices, Empty, Field, Header, Row, Screen, Stepper, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { DISTRICTS, PAYMENT_METHODS, money } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/lib/types';

const DELIVERY_FEE = 1;
const districtOptions = DISTRICTS.map((d) => ({ id: d, label: d }));

export default function Cart() {
  const { profile } = useAuth();
  const cart = useCart();
  const [district, setDistrict] = useState<string>(profile?.district ?? 'Hodan');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('evc');
  const [error, setError] = useState<string>();
  const [placing, setPlacing] = useState(false);

  if (!cart.store || cart.count === 0) {
    return (
      <Screen>
        <Header title="Dambiisha" />
        <Empty title="Dambiishaadu waa madhan tahay" body="Dooro maqaayad ama dukaan." />
      </Screen>
    );
  }

  async function place() {
    setPlacing(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('place_store_order', {
      p_store_id: cart.store!.id,
      p_items: cart.lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      p_dropoff_district: district,
      p_dropoff_note: note.trim(),
      p_payment: payment,
    });
    setPlacing(false);
    if (e) {
      setError(friendlyError(e));
      return;
    }
    cart.clear();
    router.replace(`/order/${data}`);
  }

  return (
    <Screen>
      <Header title="Dambiisha" subtitle={cart.store.name} />
      <Card>
        {cart.lines.map((l) => (
          <Row key={l.product.id} gap={Spacing.three}>
            <Txt style={{ flex: 1 }}>{l.product.name}</Txt>
            <Stepper quantity={l.quantity} onAdd={() => cart.add(cart.store!, l.product)} onRemove={() => cart.remove(l.product.id)} />
            <Txt variant="price" style={styles.amount}>{money(Number(l.product.price) * l.quantity)}</Txt>
          </Row>
        ))}
      </Card>

      <Choices label="Halkee laguu keenaa?" options={districtOptions} value={district} onChange={setDistrict} columns={3} />
      <Field label="Tilmaan" value={note} onChangeText={setNote} multiline placeholder="tus. agagaarka masjidka, albaab buluug ah" />
      <Choices label="Habka lacag bixinta" options={PAYMENT_METHODS} value={payment} onChange={setPayment} />

      <View style={{ gap: Spacing.one }}>
        <Row style={styles.between}><Txt>Wadarta alaabta</Txt><Txt variant="price">{money(cart.subtotal)}</Txt></Row>
        <Row style={styles.between}><Txt>Lacagta geynta</Txt><Txt variant="price">{money(DELIVERY_FEE)}</Txt></Row>
        <Row style={styles.between}><Txt variant="heading">Wadarta guud</Txt><Txt variant="heading">{money(cart.subtotal + DELIVERY_FEE)}</Txt></Row>
      </View>
      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button kind="gold" title={`Dir dalabka · ${money(cart.subtotal + DELIVERY_FEE)}`} onPress={place} loading={placing} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { minWidth: 56, textAlign: 'right' },
  between: { justifyContent: 'space-between' },
});
