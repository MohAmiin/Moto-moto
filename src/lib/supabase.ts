import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { TKey } from '@/lib/i18n';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Supabase's dashboard names it EXPO_PUBLIC_SUPABASE_KEY (publishable key); the older anon key name also works.
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Copy .env.example to .env and fill it in.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    // Web keeps the default browser storage; native apps persist the session in AsyncStorage.
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/** Maps a Postgres/Supabase error to a message key; show it with `t(errorKey(e))`. */
export function errorKey(error: unknown): TKey {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
  const known: [string, TKey][] = [
    ['rider is not approved', 'err.notApproved'],
    ['Invalid login credentials', 'err.badPin'],
    ['already registered', 'err.pinTaken'],
    ['rate limit', 'err.tooMany'],
    ['Too many', 'err.tooMany'],
    ['Email not confirmed', 'err.pinSetup'],
    ['Signups not allowed', 'err.pinSetup'],
    ['signups are disabled', 'err.pinSetup'],
    ['Token has expired or is invalid', 'err.badCode'],
    ['sms', 'err.smsFailed'],
    ['SMS', 'err.smsFailed'],
    ['Twilio', 'err.smsFailed'],
  ];
  for (const [needle, key] of known) {
    if (message.includes(needle)) return key;
  }
  return 'err.generic';
}
