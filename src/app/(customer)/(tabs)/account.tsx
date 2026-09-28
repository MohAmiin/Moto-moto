import { useState } from 'react';

import { Button, Choices, Header, Monogram, Row, Screen, Stack, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { DISTRICTS, formatPhone } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';

const districtOptions = DISTRICTS.map((d) => ({ id: d, label: d }));

export default function Account() {
  const { profile, refresh, signOut } = useAuth();
  const [message, setMessage] = useState<string>();

  if (!profile) return null;

  async function changeDistrict(district: string) {
    const { error } = await supabase.from('profiles').update({ district }).eq('id', profile!.id);
    if (error) setMessage(friendlyError(error));
    else {
      setMessage('Cinwaanka waa la beddelay');
      await refresh();
    }
  }

  return (
    <Screen edges={['top']}>
      <Header title="Akoonkayga" back={false} />
      <Row gap={16}>
        <Monogram name={profile.full_name} size={60} />
        <Stack gap={2}>
          <Txt variant="heading">{profile.full_name}</Txt>
          <Txt variant="muted">{formatPhone(profile.phone)}</Txt>
        </Stack>
      </Row>
      <Choices label="Degmada geynta" options={districtOptions} value={profile.district ?? 'Hodan'} onChange={changeDistrict} columns={3} />
      {message ? <Txt variant="muted">{message}</Txt> : null}
      <Button title="Ka bax" kind="ghost" onPress={signOut} />
    </Screen>
  );
}
