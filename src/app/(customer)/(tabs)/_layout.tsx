import { Tabs } from 'expo-router/tabs';

import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

export default function CustomerTabs() {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tab.home') }} />
      <Tabs.Screen name="orders" options={{ title: t('tab.orders') }} />
      <Tabs.Screen name="account" options={{ title: t('tab.account') }} />
    </Tabs>
  );
}
