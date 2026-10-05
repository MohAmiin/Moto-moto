import { Tabs } from 'expo-router/tabs';

import { AdminIcon } from '@/components/kit';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export default function CustomerTabs() {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primaryText,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.hairline },
        tabBarLabelStyle: { fontSize: 11, fontFamily: Fonts.medium },
      }}>
      {/* Tab colours come from our theme (plain strings), so the casts below are safe. */}
      <Tabs.Screen
        name="index"
        options={{ title: t('tab.home'), tabBarIcon: ({ color }) => <AdminIcon name="home" size={22} color={color as string} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tab.account'), tabBarIcon: ({ color }) => <AdminIcon name="account" size={22} color={color as string} /> }}
      />
    </Tabs>
  );
}
