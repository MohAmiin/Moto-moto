import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { Button, Card, Empty, Header, Loading, Pill, Row, Screen, Txt } from '@/components/ui';
import { money, packageKey, paymentKey } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';
import { useOrder } from '@/lib/use-order';

export default function RiderJob() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, missing, reload } = useOrder(Number(id));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (missing) {
    return (
      <Screen>
        <Header title={t('job.title', { id: id ?? '' })} />
        <Empty title={t('job.notFound')} />
      </Screen>
    );
  }
  if (!detail) return <Loading />;

  const { order, items, storeName, customer } = detail;
  const total = Number(order.items_total) + Number(order.delivery_fee);
  const pickupTitle = order.kind === 'store' ? (storeName ?? order.pickup_note) : order.pickup_note;
  const cash = order.payment_method === 'cash';

  async function advance() {
    setSaving(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('advance_order', { p_order_id: order.id });
    setSaving(false);
    if (e) {
      setError(t(errorKey(e)));
      return;
    }
    if (data === 'delivered') router.back();
    else reload();
  }

  return (
    <Screen>
      <Header
        title={t('job.title', { id: order.id })}
        subtitle={order.kind === 'store' ? t('rider.storeOrder') : t(packageKey(order.package_type))}
      />

      <Card>
        <Pill label={t('job.pickupFrom')} tone="success" />
        <Txt variant="heading">{pickupTitle}</Txt>
        <Txt variant="muted">{t('common.districtOf', { d: order.pickup_district })}</Txt>
      </Card>

      <Card>
        <Pill label={t('job.deliverTo')} tone="danger" />
        <Txt variant="heading">{customer?.full_name ?? t('common.customer')}</Txt>
        <Txt variant="muted">
          {t('common.districtOf', { d: order.dropoff_district })}
          {order.dropoff_note ? ` · ${order.dropoff_note}` : ''}
        </Txt>
        {customer?.phone ? (
          <Button kind="ghost" title={t('job.callCustomer')} onPress={() => Linking.openURL(`tel:+${customer.phone!.replace(/^\+/, '')}`)} />
        ) : null}
      </Card>

      {items.length > 0 ? (
        <Card>
          {items.map((it) => (
            <Row key={it.id} style={{ justifyContent: 'space-between' }}>
              <Txt style={{ flex: 1 }}>{it.quantity} × {it.name}</Txt>
              <Txt variant="price">{money(it.unit_price * it.quantity)}</Txt>
            </Row>
          ))}
        </Card>
      ) : null}

      <Card tone="soft">
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">{t(cash ? 'job.collectCash' : 'job.prepaid')}</Txt>
          <Txt variant="heading">{money(total)}</Txt>
        </Row>
        <Txt variant="muted">{t('job.yourShare', { method: t(paymentKey(order.payment_method)), fee: money(order.delivery_fee) })}</Txt>
      </Card>

      {error ? <Txt color="danger">{error}</Txt> : null}
      {order.status === 'accepted' ? <Button kind="gold" title={t('job.pickedUp')} onPress={advance} loading={saving} /> : null}
      {order.status === 'picked_up' ? <Button kind="gold" title={t('job.delivered')} onPress={advance} loading={saving} /> : null}
      {order.status === 'delivered' ? <Txt color="success" style={{ fontWeight: '700' }}>{t('job.done')}</Txt> : null}
    </Screen>
  );
}
