import { Tabs } from 'expo-router/tabs';

import { AdminIcon } from '@/components/admin/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export default function AdminTabs() {
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
        options={{ title: t('adm.overview'), tabBarIcon: ({ color }) => <AdminIcon name="overview" size={22} color={color as string} /> }}
      />
      <Tabs.Screen
        name="riders"
        options={{ title: t('adm.riders'), tabBarIcon: ({ color }) => <AdminIcon name="riders" size={22} color={color as string} /> }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: t('adm.customers'), tabBarIcon: ({ color }) => <AdminIcon name="customers" size={22} color={color as string} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('adm.settings'), tabBarIcon: ({ color }) => <AdminIcon name="settings" size={22} color={color as string} /> }}
      />
    </Tabs>
  );
}
