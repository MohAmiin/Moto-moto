import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Empty, Header, Loading, Monogram, Pill, Row, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { money, packageKey, paymentKey, statusLongKey } from '@/lib/format';
import { useI18n, type TKey } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/lib/types';
import { useOrder } from '@/lib/use-order';

const STEPS: OrderStatus[] = ['placed', 'accepted', 'picked_up', 'delivered'];

export default function OrderTracking() {
  const theme = useTheme();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, missing, reload } = useOrder(Number(id));
  const [error, setError] = useState<string>();
  const [cancelling, setCancelling] = useState(false);

  if (missing) {
    return (
      <Screen>
        <Header title={t('common.orderNumber', { id: id ?? '' })} />
        <Empty title={t('order.notFound')} />
      </Screen>
    );
  }
  if (!detail) return <Loading />;

  const { order, items, storeName, rider } = detail;
  const current = STEPS.indexOf(order.status);
  const title =
    order.kind === 'store' ? (storeName ?? t('common.store')) : t('common.route', { from: order.pickup_district, to: order.dropoff_district });

  async function cancel() {
    setCancelling(true);
    const { error: e } = await supabase.rpc('cancel_order', { p_order_id: order.id });
    setCancelling(false);
    if (e) setError(t(errorKey(e)));
    else reload();
  }

  return (
    <Screen>
      <Header title={t('common.orderNumber', { id: order.id })} subtitle={title} />
      <View style={{ gap: Spacing.one }}>
        <Txt variant="muted">{order.status === 'delivered' ? t('order.thanks') : t('order.status')}</Txt>
        <Txt variant="title">{t(statusLongKey(order.status))}</Txt>
      </View>

      {order.status !== 'cancelled' ? (
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, gap: 6 }}>
              <View style={[styles.bar, { backgroundColor: i <= current ? theme.brand : theme.border }]} />
              <Txt style={{ fontSize: 12, fontWeight: '600' }} color={i <= current ? 'text' : 'textSecondary'}>
                {t(`step.${s}` as TKey)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {rider ? (
        <Card>
          <Row gap={Spacing.three}>
            <Monogram name={rider.full_name} size={48} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '700' }}>{rider.full_name}</Txt>
              <Txt variant="muted">{t('order.yourRider')}</Txt>
            </View>
            {rider.plate ? (
              <View style={[styles.plate, { borderColor: theme.text }]}>
                <Txt style={{ fontWeight: '800', fontSize: 12 }}>{rider.plate}</Txt>
              </View>
            ) : null}
          </Row>
          {rider.phone && order.status !== 'delivered' ? (
            <Button title={t('order.callRider')} onPress={() => Linking.openURL(`tel:+${rider.phone!.replace(/^\+/, '')}`)} />
          ) : null}
        </Card>
      ) : null}

      <Card>
        {order.kind === 'store' ? (
          items.map((it) => (
            <Row key={it.id} style={styles.between}>
              <Txt style={{ flex: 1 }}>{it.quantity} × {it.name}</Txt>
              <Txt variant="price">{money(it.unit_price * it.quantity)}</Txt>
            </Row>
          ))
        ) : (
          <>
            <Txt style={{ fontWeight: '700' }}>{t(packageKey(order.package_type))}</Txt>
            <Txt variant="muted">{t('order.pickup', { place: `${order.pickup_district} · ${order.pickup_note}` })}</Txt>
            <Txt variant="muted">{t('order.dropoff', { place: `${order.dropoff_district} · ${order.dropoff_note}` })}</Txt>
          </>
        )}
        <Row style={styles.between}>
          <Txt>{t('common.deliveryFee')}</Txt>
          <Txt variant="price">{money(order.delivery_fee)}</Txt>
        </Row>
        <Row style={styles.between}>
          <Txt variant="heading">{t('common.total')}</Txt>
          <Txt variant="heading">{money(Number(order.items_total) + Number(order.delivery_fee))}</Txt>
        </Row>
        <Pill label={t(paymentKey(order.payment_method))} />
      </Card>

      {error ? <Txt color="danger">{error}</Txt> : null}
      {order.status === 'placed' ? <Button kind="danger" title={t('order.cancel')} onPress={cancel} loading={cancelling} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: Spacing.two },
  bar: { height: 6, borderRadius: 6 },
  plate: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  between: { justifyContent: 'space-between' },
});
