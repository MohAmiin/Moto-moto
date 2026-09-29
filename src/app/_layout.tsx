import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider, useI18n } from '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <LanguageProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { loading, session, profile } = useAuth();
  const { ready, isRTL } = useI18n();
  const busy = loading || !ready;

  useEffect(() => {
    if (!busy) SplashScreen.hideAsync();
  }, [busy]);

  if (busy) return null;

  const role = profile?.role;
  return (
    // Arabic lays every screen out right to left. On web the page's dir attribute does this instead.
    <View style={Platform.OS === 'web' ? { flex: 1 } : { flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={role === 'customer'}>
          <Stack.Screen name="(customer)" />
        </Stack.Protected>
        <Stack.Protected guard={role === 'rider'}>
          <Stack.Screen name="rider" />
        </Stack.Protected>
        <Stack.Protected guard={role === 'admin'}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !profile}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="verify" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}
