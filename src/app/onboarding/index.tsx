import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LanguageSwitcher, LinkButton, Screen, Stack, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function ChooseRole() {
  const theme = useTheme();
  const { t } = useI18n();
  const { signOut } = useAuth();

  const options = [
    {
      href: '/onboarding/customer' as const,
      title: t('onb.customerTitle'),
      body: t('onb.customerBody'),
      bg: theme.brand,
      fg: theme.onBrand,
    },
    {
      href: '/onboarding/rider' as const,
      title: t('onb.riderTitle'),
      body: t('onb.riderBody'),
      bg: theme.text,
      fg: theme.background,
    },
  ];

  return (
    <Screen>
      <LanguageSwitcher />
      <Stack gap={Spacing.one}>
        <Txt variant="title">{t('onb.welcome')}</Txt>
        <Txt variant="muted">{t('onb.how')}</Txt>
      </Stack>
      {options.map((o) => (
        <Pressable
          key={o.href}
          accessibilityRole="button"
          onPress={() => router.push(o.href)}
          style={({ pressed }) => [styles.option, { backgroundColor: o.bg, opacity: pressed ? 0.9 : 1 }]}>
          <Txt variant="heading" style={{ color: o.fg }}>{o.title}</Txt>
          <Txt style={{ color: o.fg, opacity: 0.85 }}>{o.body}</Txt>
          <View style={[styles.choose, { borderColor: o.fg }]}>
            <Txt style={{ color: o.fg, fontWeight: '800' }}>{t('onb.choose')}</Txt>
          </View>
        </Pressable>
      ))}
      <LinkButton title={t('common.signOut')} onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.two },
  choose: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 4, marginTop: Spacing.one },
});
