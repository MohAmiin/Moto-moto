import { useState } from 'react';

import { AdminButton, AdminScreen, DetailBar, FilterChips, Panel, TextField } from '@/components/kit';
import { Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { accountPhone } from '@/lib/pin';
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
      .insert({ id: session.user.id, role: 'customer', full_name: name.trim(), phone: accountPhone(session.user), district });
    if (e) {
      setSaving(false);
      setError(t(errorKey(e)));
      return;
    }
    await refresh();
  }

  return (
    <AdminScreen edges={['top', 'bottom']} header={<DetailBar title={t('onb.detailsTitle')} />}>
      <Txt variant="muted" style={{ fontSize: 14, lineHeight: 20 }}>
        {t('onb.detailsSub')}
      </Txt>
      <Panel>
        <TextField label={t('onb.yourName')} value={name} onChangeText={setName} autoComplete="name" placeholder={t('onb.namePh')} error={error} />
        <Txt variant="muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {t('onb.yourDistrict')}
        </Txt>
        <FilterChips options={AREA_OPTIONS} value={district} onChange={setDistrict} />
        <Txt variant="muted" style={{ fontSize: 13, lineHeight: 18 }}>
          {t('onb.changeLater')}
        </Txt>
        <AdminButton title={t('onb.start')} onPress={save} loading={saving} />
      </Panel>
    </AdminScreen>
  );
}
