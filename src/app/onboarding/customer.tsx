import { useState } from 'react';

import { Button, Choices, Field, Header, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

export default function CustomerOnboarding() {
  const { t } = useI18n();
  const { session, refresh } = useAuth();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState<string>(DEFAULT_AREA);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!session) return;
    if (name.trim().length < 2) {
      setError(t('onb.nameRequired'));
      return;
    }
    setSaving(true);
    const { error: e } = await supabase
      .from('profiles')
      .insert({ id: session.user.id, role: 'customer', full_name: name.trim(), phone: session.user.phone ?? null, district });
    if (e) {
      setSaving(false);
      setError(t(errorKey(e)));
      return;
    }
    await refresh();
  }

  return (
    <Screen>
      <Header title={t('onb.detailsTitle')} subtitle={t('onb.detailsSub')} />
      <Field label={t('onb.yourName')} value={name} onChangeText={setName} autoComplete="name" placeholder={t('onb.namePh')} error={error} />
      <Choices label={t('onb.yourDistrict')} options={AREA_OPTIONS} value={district} onChange={setDistrict} columns={2} />
      <Txt variant="muted">{t('onb.changeLater')}</Txt>
      <Button title={t('onb.start')} onPress={save} loading={saving} />
    </Screen>
  );
}
