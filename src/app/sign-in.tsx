import { Image } from 'expo-image';
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
      <View style={styles.logoPanel}>
        <Image
          source={require('@/assets/images/logo-full.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Jareeye Moto Delivery"
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={[styles.hero, { backgroundColor: '#0046B5' }]}>
        <Txt variant="title" style={{ color: '#FFFFFF' }}>{t('signin.headline')}</Txt>
        <Txt style={{ color: '#FFFFFF', opacity: 0.85 }}>{t('signin.sub')}</Txt>
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
  logoPanel: { backgroundColor: '#FFFFFF', borderRadius: Radius.large + 2, padding: Spacing.three, alignItems: 'center' },
  logo: { width: '100%', height: 190 },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontWeight: '900', fontSize: 13 },
});
