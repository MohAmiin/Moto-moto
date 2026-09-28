import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, PhoneField, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isValidLocalPhone, normalizeLocalPhone, toE164 } from '@/lib/somali';
import { friendlyError, supabase } from '@/lib/supabase';

export default function SignIn() {
  const theme = useTheme();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  async function sendCode() {
    const local = normalizeLocalPhone(phone);
    if (!isValidLocalPhone(local)) {
      setError('Fadlan geli lambar sax ah, tusaale 61 234 5678');
      return;
    }
    setError(undefined);
    setSending(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: toE164(local) });
    setSending(false);
    if (otpError) {
      setError(friendlyError(otpError));
      return;
    }
    router.push({ pathname: '/verify', params: { phone: local } });
  }

  return (
    <Screen>
      <View style={[styles.hero, { backgroundColor: theme.brand }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logo, { backgroundColor: theme.gold }]}>
            <Txt style={[styles.logoText, { color: theme.onGold }]}>D</Txt>
          </View>
          <Txt style={[styles.wordmark, { color: theme.onBrand }]}>Dhaqso</Txt>
        </View>
        <Txt variant="title" style={{ color: theme.onBrand }}>
          Cunto, raashin iyo daawo, albaabkaaga ayey kuugu imaanayaan.
        </Txt>
        <Txt style={{ color: theme.onBrand, opacity: 0.9 }}>Mooto ayaa u geysa meel kasta oo magaalada ah.</Txt>
        <View style={[styles.badge, { backgroundColor: theme.gold }]}>
          <Txt style={[styles.badgeText, { color: theme.onGold }]}>Geyn $1 meel kasta</Txt>
        </View>
      </View>

      <Stack>
        <PhoneField value={phone} onChangeText={setPhone} error={error} />
        <Txt variant="muted">Koodh SMS ah ayaan kuu soo diri doonnaa si aad u xaqiijiso lambarkaaga.</Txt>
        <Button title="Dir koodhka" onPress={sendCode} loading={sending} />
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          Macmiil iyo darawal labaduba halkan ayey ka galaan.
        </Txt>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.large + 2, padding: Spacing.four, gap: Spacing.three, marginTop: Spacing.three },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '900' },
  wordmark: { fontSize: 22, fontWeight: '900' },
  badge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontWeight: '900', fontSize: 13 },
});
