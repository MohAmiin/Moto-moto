import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Choices, Field, Header, Row, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA, PACKAGE_TYPES, PAYMENT_METHODS, packageKey, paymentKey, type PackageType } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/lib/types';

export default function SendPackage() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [from, setFrom] = useState<string>(profile?.district ?? DEFAULT_AREA);
  const [fromNote, setFromNote] = useState('');
  const [to, setTo] = useState<string>(AREA_OPTIONS[1].id);
  const [toNote, setToNote] = useState('');
  const [type, setType] = useState<PackageType>('xirmo');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string>();
  const [placing, setPlacing] = useState(false);

  async function place() {
    if (!fromNote.trim() || !toNote.trim()) {
      setError(t('send.needDirections'));
      return;
    }
    setPlacing(true);
    setError(undefined);
    const { data, error: e } = await supabase.rpc('place_package_order', {
      p_pickup_district: from,
      p_pickup_note: fromNote.trim(),
      p_dropoff_district: to,
      p_dropoff_note: toNote.trim(),
      p_package_type: type,
      p_payment: payment,
    });
    setPlacing(false);
    if (e) {
      setError(t(errorKey(e)));
      return;
    }
    router.replace(`/order/${data}`);
  }

  return (
    <Screen>
      <Header title={t('send.title')} subtitle={t('send.sub')} />
      <Card>
        <Choices label={t('send.from')} options={AREA_OPTIONS} value={from} onChange={setFrom} columns={2} />
        <Field label={t('send.fromNote')} value={fromNote} onChangeText={setFromNote} placeholder={t('send.fromPh')} />
      </Card>
      <Card>
        <Choices label={t('send.to')} options={AREA_OPTIONS} value={to} onChange={setTo} columns={2} />
        <Field label={t('send.toNote')} value={toNote} onChangeText={setToNote} placeholder={t('send.toPh')} />
      </Card>
      <Choices label={t('send.what')} options={PACKAGE_TYPES.map((id) => ({ id, label: t(packageKey(id)) }))} value={type} onChange={setType} columns={4} />
      <Choices
        label={t('cart.payWith')}
        options={PAYMENT_METHODS.map((id) => ({ id, label: t(paymentKey(id)), hint: t(id === 'cash' ? 'pay.cashHint' : 'pay.mobileHint') }))}
        value={payment}
        onChange={setPayment}
      />
      <Card tone="soft">
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">{t('send.price')}</Txt>
          <Txt variant="big">$1</Txt>
        </Row>
        <Txt variant="muted">{t('send.flat')}</Txt>
      </Card>
      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button kind="gold" title={t('send.place')} onPress={place} loading={placing} />
    </Screen>
  );
}
