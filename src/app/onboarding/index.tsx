import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LinkButton, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

export default function ChooseRole() {
  const theme = useTheme();
  const { signOut } = useAuth();

  const options = [
    {
      href: '/onboarding/customer' as const,
      title: 'Waxaan ahay macmiil',
      body: 'Dalbo cunto, raashin iyo daawo, ama dir xirmo. Geyntu waa $1.',
      bg: theme.brand,
      fg: theme.onBrand,
    },
    {
      href: '/onboarding/rider' as const,
      title: 'Waxaan ahay darawal mooto',
      body: 'Qaado dalabyo, hel $1 safar kasta. Waxaan hubineynaa aqoonsigaaga ka hor intaadan bilaabin.',
      bg: theme.text,
      fg: theme.background,
    },
  ];

  return (
    <Screen>
      <Stack gap={Spacing.one}>
        <Txt variant="title">Ku soo dhawoow Dhaqso</Txt>
        <Txt variant="muted">Sidee u isticmaalaysaa app-ka?</Txt>
      </Stack>
      {options.map((o) => (
        <Pressable
          key={o.href}
          accessibilityRole="button"
          onPress={() => router.push(o.href)}
          style={({ pressed }) => [styles.option, { backgroundColor: o.bg, opacity: pressed ? 0.9 : 1 }]}>
          <Txt variant="heading" style={{ color: o.fg }}>{o.title}</Txt>
          <Txt style={{ color: o.fg, opacity: 0.85 }}>{o.body}</Txt>
          <View style={[styles.arrow, { borderColor: o.fg }]}>
            <Txt style={{ color: o.fg, fontWeight: '800' }}>Dooro →</Txt>
          </View>
        </Pressable>
      ))}
      <LinkButton title="Ka bax" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  arrow: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4, marginTop: Spacing.one },
});
