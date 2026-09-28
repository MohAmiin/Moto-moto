import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Header, LinkButton, Screen, Stack, Txt } from '@/components/ui';
import { formatPhone, toE164 } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';

export default function Verify() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError('Koodhku waa 6 lambar');
      return;
    }
    setError(undefined);
    setChecking(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
    setChecking(false);
    // On success the auth listener updates the session and the router moves on by itself.
    if (verifyError) setError(friendlyError(verifyError));
  }

  async function resend() {
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    if (otpError) setError(friendlyError(otpError));
    else setResent(true);
  }

  return (
    <Screen>
      <Header title="Geli koodhka" subtitle={`Waxaan u dirnay ${formatPhone(phone)}`} />
      <Stack>
        <Field
          label="Koodhka SMS-ka"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          placeholder="••••••"
          error={error}
          style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '800' }}
          autoFocus
        />
        <Button title="Xaqiiji" onPress={verify} loading={checking} />
        {resent ? <Txt variant="muted">Koodh cusub ayaa laguu diray.</Txt> : <LinkButton title="Koodh cusub ii soo dir" onPress={resend} />}
        <LinkButton title="Beddel lambarka" onPress={() => router.back()} />
      </Stack>
    </Screen>
  );
}
