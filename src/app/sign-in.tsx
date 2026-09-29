import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, LanguageSwitcher, PhoneField, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidLocalPhone, normalizeLocalPhone, toE164 } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { errorKey, supabase } from '@/lib/supabase';

export default function SignIn() {
  const theme = useTheme();
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function sendCode() {
    const local = normalizeLocalPhone(phone);
    if (!isValidLocalPhone(local)) {
      setError(t('signin.invalidPhone'));
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: toE164(local) });
    setSending(false);
    if (otpError) {
      setError(t(errorKey(otpError)));
      return;
    }
    router.push({ pathname: '/verify', params: { phone: local } });
  }

  return (
    <Screen>
      <LanguageSwitcher />
      <View style={[styles.hero, { backgroundColor: theme.brand }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logo, { backgroundColor: theme.gold }]}>
            <Txt style={[styles.logoText, { color: theme.onGold }]}>S</Txt>
          </View>
          <Txt style={[styles.wordmark, { color: theme.onBrand }]}>SABIQ</Txt>
        </View>
        <Txt variant="title" style={{ color: theme.onBrand }}>{t('signin.headline')}</Txt>
        <Txt style={{ color: theme.onBrand, opacity: 0.9 }}>{t('signin.sub')}</Txt>
        <View style={[styles.badge, { backgroundColor: theme.gold }]}>
          <Txt style={[styles.badgeText, { color: theme.onGold }]}>{t('signin.badge')}</Txt>
        </View>
      </View>

      <Stack>
        <PhoneField value={phone} onChangeText={setPhone} error={error} />
        <Txt variant="muted">{t('signin.smsNote')}</Txt>
        <Button title={t('signin.send')} onPress={sendCode} loading={sending} />
        <Txt variant="muted" style={{ textAlign: 'center' }}>{t('signin.both')}</Txt>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.large + 2, padding: Spacing.four, gap: Spacing.three },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '900' },
  wordmark: { fontSize: 22, fontWeight: '900' },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontWeight: '900', fontSize: 13 },
});
