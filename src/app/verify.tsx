import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AdminButton, AdminScreen, DetailBar, Panel, TextField } from '@/components/kit';
import { LinkButton, Txt } from '@/components/ui';
import { formatPhone, toE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

export default function Verify() {
  const { t } = useI18n();
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError(t('verify.sixDigits'));
      return;
    }
    setError(undefined);
    setChecking(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'sms' });
    setChecking(false);
    // On success the auth listener updates the session and the router moves on by itself.
    if (verifyError) setError(t(errorKey(verifyError)));
  }

  async function resend() {
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
    if (otpError) setError(t(errorKey(otpError)));
    else setResent(true);
  }

  return (
    <AdminScreen edges={['top', 'bottom']} header={<DetailBar title={t('verify.title')} />}>
      <Panel>
        <Txt variant="muted" style={{ fontSize: 14, lineHeight: 20 }}>
          {t('verify.sentTo', { phone: formatPhone(phone) })}
        </Txt>
        <TextField
          label={t('verify.label')}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          placeholder="••••••"
          error={error}
          style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center', writingDirection: 'ltr' }}
          autoFocus
        />
        <AdminButton title={t('verify.confirm')} onPress={verify} loading={checking} />
        {resent ? (
          <Txt variant="muted" style={{ fontSize: 13 }}>
            {t('verify.resent')}
          </Txt>
        ) : (
          <LinkButton title={t('verify.resend')} onPress={resend} />
        )}
        <LinkButton title={t('verify.changeNumber')} onPress={() => router.back()} />
      </Panel>
    </AdminScreen>
  );
}
