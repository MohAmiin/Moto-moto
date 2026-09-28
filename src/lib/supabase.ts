import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
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

/** Turns a Postgres/Supabase error into a message we can show in Somali. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
  const known: Record<string, string> = {
    'order was taken by another rider': 'Darawal kale ayaa qaatay dalabkan.',
    'finish your current job first': 'Marka hore dhammee shaqada aad hayso.',
    'rider is not approved': 'Weli lagu ma ansixin.',
    'order can no longer be cancelled': 'Dalabkan lama joojin karo hadda.',
    'store is closed or missing': 'Meeshan hadda way xiran tahay.',
    'product unavailable': 'Shay ka mid ah dalabka hadda lama heli karo.',
    'order is empty': 'Dambiishaadu waa madhan tahay.',
    'Token has expired or is invalid': 'Koodhku waa khalad ama wuu dhacay.',
  };
  for (const [needle, somali] of Object.entries(known)) {
    if (message.includes(needle)) return somali;
  }
  return 'Wax khalad ah ayaa dhacay. Fadlan mar kale isku day.';
}
