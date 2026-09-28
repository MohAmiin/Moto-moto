import { Tabs } from 'expo-router/tabs';

import { useTheme } from '@/hooks/use-theme';

export default function CustomerTabs() {
  const theme = useTheme();
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
      <Tabs.Screen name="index" options={{ title: 'Hoyga' }} />
      <Tabs.Screen name="orders" options={{ title: 'Dalabyada' }} />
      <Tabs.Screen name="account" options={{ title: 'Akoon' }} />
    </Tabs>
  );
}
