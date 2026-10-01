import { useState } from 'react';

import { DeleteAccount } from '@/components/delete-account';
import { Button, Choices, Header, LanguageSwitcher, Monogram, Row, Screen, Stack, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AREA_OPTIONS, DEFAULT_AREA, formatPhone } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

export default function Account() {
  const { t } = useI18n();
  const { profile, refresh, signOut } = useAuth();
  const [message, setMessage] = useState<string>();

  if (!profile) return null;

  async function changeDistrict(district: string) {
    const { error } = await supabase.from('profiles').update({ district }).eq('id', profile!.id);
    if (error) setMessage(t(errorKey(error)));
    else {
      setMessage(t('acct.addressChanged'));
      await refresh();
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title={t('acct.title')} back={false} />
      <Row gap={16}>
        <Monogram name={profile.full_name} size={60} />
        <Stack gap={2}>
          <Txt variant="heading">{profile.full_name}</Txt>
          <Txt variant="muted">{formatPhone(profile.phone)}</Txt>
        </Stack>
      </Row>
      <Stack gap={8}>
        <Txt variant="label">{t('common.language')}</Txt>
        <LanguageSwitcher />
      </Stack>
      <Choices label={t('acct.deliveryDistrict')} options={AREA_OPTIONS} value={profile.district ?? DEFAULT_AREA} onChange={changeDistrict} columns={2} />
      {message ? <Txt variant="muted">{message}</Txt> : null}
      <Button title={t('common.signOut')} kind="ghost" onPress={signOut} />
      <DeleteAccount />
    </Screen>
  );
}
