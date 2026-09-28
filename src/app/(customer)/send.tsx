import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Choices, Field, Header, Row, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DISTRICTS, PACKAGE_TYPES, PAYMENT_METHODS } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/lib/types';

const districtOptions = DISTRICTS.map((d) => ({ id: d, label: d }));
type PackageType = (typeof PACKAGE_TYPES)[number]['id'];

export default function SendPackage() {
  const { profile } = useAuth();
  const [from, setFrom] = useState<string>(profile?.district ?? 'Hodan');
  const [fromNote, setFromNote] = useState('');
  const [to, setTo] = useState<string>('Wadajir');
  const [toNote, setToNote] = useState('');
  const [type, setType] = useState<PackageType>('xirmo');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string>();
  const [placing, setPlacing] = useState(false);

  async function place() {
    if (!fromNote.trim() || !toNote.trim()) {
      setError('Fadlan geli tilmaan labada meelood si darawalku u helo');
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
      setError(friendlyError(e));
      return;
    }
    router.replace(`/order/${data}`);
  }

  return (
    <Screen>
      <Header title="Dir xirmo" subtitle="Meel kasta oo magaalada ah · $1" />
      <Card>
        <Choices label="Laga qaado (degmada)" options={districtOptions} value={from} onChange={setFrom} columns={3} />
        <Field label="Tilmaanta meesha laga qaadayo" value={fromNote} onChangeText={setFromNote} placeholder="tus. dukaanka Xamar, weydii Cali" />
      </Card>
      <Card>
        <Choices label="Loo geeyo (degmada)" options={districtOptions} value={to} onChange={setTo} columns={3} />
        <Field label="Tilmaanta meesha loo geynayo" value={toNote} onChangeText={setToNote} placeholder="tus. guriga ka soo horjeeda iskuulka" />
      </Card>
      <Choices label="Maxaa la dirayaa?" options={PACKAGE_TYPES} value={type} onChange={setType} columns={4} />
      <Choices label="Habka lacag bixinta" options={PAYMENT_METHODS} value={payment} onChange={setPayment} />
      <Card tone="soft">
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">Qiimaha geynta</Txt>
          <Txt variant="big">$1</Txt>
        </Row>
        <Txt variant="muted">Hal qiime meel kasta oo magaalada ah. Gorgortan ma jiro.</Txt>
      </Card>
      {error ? <Txt color="danger">{error}</Txt> : null}
      <Button kind="gold" title="Dalbo mooto · $1" onPress={place} loading={placing} />
    </Screen>
  );
}
