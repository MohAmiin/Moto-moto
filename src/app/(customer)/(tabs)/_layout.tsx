import { Tabs } from 'expo-router/tabs';

import { Icon, Icons } from '@/components/feed';
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
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarLabelStyle: { fontSize: 12, fontFamily: Fonts.medium },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tab.home'), tabBarIcon: ({ color }) => <Icon source={Icons.home} size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('tab.account'), tabBarIcon: ({ color }) => <Icon source={Icons.user} size={24} color={color} /> }}
      />
    </Tabs>
  );
}
