import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { useFonts } from 'expo-font';
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
  const [fontsLoaded, fontError] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_700Bold, Rubik_800ExtraBold });
  // If the fonts fail to load the app still opens, in the system font.
  const busy = loading || !ready || (!fontsLoaded && !fontError);

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
