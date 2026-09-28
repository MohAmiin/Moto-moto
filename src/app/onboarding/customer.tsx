import { useState } from 'react';

import { Button, Choices, Field, Header, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DISTRICTS } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';

const districtOptions = DISTRICTS.map((d) => ({ id: d, label: d }));

export default function CustomerOnboarding() {
  const { session, refresh } = useAuth();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState<string>('Hodan');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!session) return;
    if (name.trim().length < 2) {
      setError('Fadlan geli magacaaga');
      return;
    }
    setSaving(true);
    const { error: e } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, role: 'customer', full_name: name.trim(), phone: session.user.phone ?? null, district });
    if (e) {
      setSaving(false);
      setError(friendlyError(e));
      return;
    }
    await refresh();
  }

  return (
    <Screen>
      <Header title="Macluumaadkaaga" subtitle="Nala sheeg magacaaga iyo halka aan wax kuugu keenno." />
      <Field label="Magacaaga" value={name} onChangeText={setName} autoComplete="name" placeholder="tus. Hodan Axmed" error={error} />
      <Choices label="Degmada aad joogto" options={districtOptions} value={district} onChange={setDistrict} columns={3} />
      <Txt variant="muted">Waad beddeli kartaa cinwaanka mar kasta oo aad dalbanayso.</Txt>
      <Button title="Bilow" onPress={save} loading={saving} />
    </Screen>
  );
}
