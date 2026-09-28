import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { Button, Card, Empty, Header, Loading, Pill, Row, Screen, Txt } from '@/components/ui';
import { money, packageLabel, paymentLabel } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';
import { useOrder } from '@/lib/use-order';

export default function RiderJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, missing, reload } = useOrder(Number(id));
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (missing) {
    return (
      <Screen>
        <Header title="Shaqo" />
        <Empty title="Shaqadan lama helin" />
      </Screen>
    );
  }
  if (!detail) return <Loading />;

  const { order, items, storeName, customer } = detail;
  const total = Number(order.items_total) + Number(order.delivery_fee);
  const pickupTitle = order.kind === 'store' ? (storeName ?? order.pickup_note) : order.pickup_note;

  async function advance() {
    setSaving(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('advance_order', { p_order_id: order.id });
    setSaving(false);
    if (e) {
      setError(friendlyError(e));
      return;
    }
    if (data === 'delivered') router.back();
    else reload();
  }

  return (
    <Screen>
      <Header title={`Shaqo #${order.id}`} subtitle={order.kind === 'store' ? 'Dalab dukaan' : packageLabel(order.package_type)} />

      <Card>
        <Pill label="Ka qaad" tone="success" />
        <Txt variant="heading">{pickupTitle}</Txt>
        <Txt variant="muted">Degmada {order.pickup_district}</Txt>
      </Card>

      <Card>
        <Pill label="Geey" tone="danger" />
        <Txt variant="heading">{customer?.full_name ?? 'Macmiil'}</Txt>
        <Txt variant="muted">Degmada {order.dropoff_district}{order.dropoff_note ? ` · ${order.dropoff_note}` : ''}</Txt>
        {customer?.phone ? (
          <Button kind="ghost" title="Wac macmiilka" onPress={() => Linking.openURL(`tel:+${customer.phone!.replace(/^\+/, '')}`)} />
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
          <Txt variant="heading">{order.payment_method === 'cash' ? 'Ka qaado lacag caddaan ah' : 'Horay loo bixiyay'}</Txt>
          <Txt variant="heading">{money(total)}</Txt>
        </Row>
        <Txt variant="muted">{paymentLabel(order.payment_method)} · Adiga: {money(order.delivery_fee)}</Txt>
      </Card>

      {error ? <Txt color="danger">{error}</Txt> : null}
      {order.status === 'accepted' ? <Button kind="gold" title="Waan qaatay" onPress={advance} loading={saving} /> : null}
      {order.status === 'picked_up' ? <Button kind="gold" title="Waan geeyay" onPress={advance} loading={saving} /> : null}
      {order.status === 'delivered' ? <Txt color="success" style={{ fontWeight: '700' }}>Shaqadan waa dhammaatay.</Txt> : null}
    </Screen>
  );
}
