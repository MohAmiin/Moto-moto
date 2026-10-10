import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AdminIcon, AdminScreen, FilterChips, TopBar, type AdminIconName } from '@/components/kit';
import { LinkButton, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, useI18n } from '@/lib/i18n';

export default function ChooseRole() {
  const theme = useTheme();
  const { t, language, setLanguage } = useI18n();
  const { signOut } = useAuth();

  const options: { href: '/onboarding/customer' | '/onboarding/rider'; icon: AdminIconName; title: string; body: string; accent: boolean }[] = [
    { href: '/onboarding/customer', icon: 'customers', title: t('onb.customerTitle'), body: t('onb.customerBody'), accent: false },
    { href: '/onboarding/rider', icon: 'riders', title: t('onb.riderTitle'), body: t('onb.riderBody'), accent: true },
  ];

  return (
    <AdminScreen edges={['top', 'bottom']} header={<TopBar title={t('onb.welcome')} showProfile={false} />}>
      <FilterChips options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} value={language} onChange={setLanguage} />
      <Txt variant="muted" style={styles.lead}>
        {t('onb.how')}
      </Txt>
      {options.map((o) => (
        <Pressable
          key={o.href}
          accessibilityRole="button"
          accessibilityLabel={`${o.title}. ${o.body}`}
          onPress={() => router.push(o.href)}
          style={({ pressed }) => [styles.option, { backgroundColor: theme.surface, borderColor: theme.hairline, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[styles.icon, { backgroundColor: o.accent ? theme.accentSoft : theme.primarySoft }]}>
            <AdminIcon name={o.icon} size={22} color={o.accent ? theme.accentText : theme.primaryText} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={styles.title}>{o.title}</Txt>
            <Txt variant="muted" style={styles.body}>
              {o.body}
            </Txt>
          </View>
          <AdminIcon name="forward" size={16} color={theme.textSecondary} />
        </Pressable>
      ))}
      <LinkButton title={t('common.signOut')} onPress={signOut} />
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: Spacing.three, minHeight: 72 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  body: { fontSize: 13, lineHeight: 18 },
});
