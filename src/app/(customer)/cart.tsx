import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Choices, Empty, Field, Header, Row, Screen, Stepper, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { AREA_OPTIONS, DEFAULT_AREA, PAYMENT_METHODS, money, paymentKey } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/lib/types';

const DELIVERY_FEE = 1;

export default function Cart() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const cart = useCart();
  const [district, setDistrict] = useState<string>(profile?.district ?? DEFAULT_AREA);
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('evc');
  const [error, setError] = useState<string>();
  const [placing, setPlacing] = useState(false);

  if (!cart.store || cart.count === 0) {
    return (
      <Screen>
        <Header title={t('cart.title')} />
        <Empty title={t('cart.empty')} body={t('cart.emptyBody')} />
      </Screen>
    );
  }

  const payOptions = PAYMENT_METHODS.map((id) => ({ id, label: t(paymentKey(id)), hint: t(id === 'cash' ? 'pay.cashHint' : 'pay.mobileHint') }));

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
      setError(t(errorKey(e)));
      return;
    }
    cart.clear();
    router.replace(`/order/${data}`);
  }

  return (
    <Screen>
      <Header title={t('cart.title')} subtitle={cart.store.name} />
      <Card>
        {cart.lines.map((l) => (
          <Row key={l.product.id} gap={Spacing.three}>
            <Txt style={{ flex: 1 }}>{l.product.name}</Txt>
            <Stepper quantity={l.quantity} onAdd={() => cart.add(cart.store!, l.product)} onRemove={() => cart.remove(l.product.id)} />
            <Txt variant="price" style={styles.amount}>{money(Number(l.product.price) * l.quantity)}</Txt>
          </Row>
        ))}
      </Card>

      <Choices label={t('cart.where')} options={AREA_OPTIONS} value={district} onChange={setDistrict} columns={2} />
      <Field label={t('cart.directions')} value={note} onChangeText={setNote} multiline placeholder={t('cart.directionsPh')} />
      <Choices label={t('cart.payWith')} options={payOptions} value={payment} onChange={setPayment} />

      <View style={{ gap: Spacing.one }}>
        <Row style={styles.between}><Txt>{t('cart.itemsTotal')}</Txt><Txt variant="price">{money(cart.subtotal)}</Txt></Row>
        <Row style={styles.between}><Txt>{t('common.deliveryFee')}</Txt><Txt variant="price">{money(DELIVERY_FEE)}</Txt></Row>
        <Row style={styles.between}><Txt variant="heading">{t('cart.grandTotal')}</Txt><Txt variant="heading">{money(cart.subtotal + DELIVERY_FEE)}</Txt></Row>
      </View>
      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button kind="gold" title={t('cart.place', { total: money(cart.subtotal + DELIVERY_FEE) })} onPress={place} loading={placing} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { minWidth: 56, textAlign: 'right', writingDirection: 'ltr' },
  between: { justifyContent: 'space-between' },
});
