import { Tabs } from 'expo-router/tabs';

import { AdminIcon } from '@/components/kit';
import { RiderApplicationScreen } from '@/components/rider-application-screen';
import { IncomingRequest } from '@/components/rider/incoming-request';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { RiderAvailabilityProvider } from '@/lib/rider-availability-context';
import { RiderRequestsProvider } from '@/lib/rider-requests-context';

/**
 * Riders without an approved application see their application status (or the form). Approved riders
 * get Home, Map and Account, sharing one availability controller.
 */
export default function RiderLayout() {
  const theme = useTheme();
  const { t } = useI18n();
  const { profile, application } = useAuth();
  if (!profile) return null;
  if (application?.status !== 'approved') return <RiderApplicationScreen />;

  return (
    <RiderAvailabilityProvider riderId={profile.id}>
      <RiderRequestsProvider riderId={profile.id}>
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
          name="map"
          options={{ title: t('rx.mapTab'), tabBarIcon: ({ color }) => <AdminIcon name="map" size={22} color={color as string} /> }}
        />
        <Tabs.Screen
          name="account"
          options={{ title: t('tab.account'), tabBarIcon: ({ color }) => <AdminIcon name="account" size={22} color={color as string} /> }}
        />
      </Tabs>
      {/* A request offered to this rider shows over any tab. */}
      <IncomingRequest />
      </RiderRequestsProvider>
    </RiderAvailabilityProvider>
  );
}
