import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Push notifications: riders hear about new requests, customers about their request.
// Android needs Firebase (google-services.json in the build); without it, or in Expo Go, getting a token
// fails and the app simply works without pushes. The web never registers.

const TOKEN_KEY = 'jareeye.pushToken';
const CHANNEL = 'requests';
const native = Platform.OS === 'android' || Platform.OS === 'ios';

if (native) {
  // Show notifications while the app is open too: a new request must not be missed.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** Asks for permission (once), and saves this phone's push token for the signed-in person. */
export async function registerForPush(language: string) {
  if (!native) return null;
  try {
    if (Platform.OS === 'android') {
      // The channel must exist before asking: Android 13+ only shows the prompt then. Its importance
      // and sound can't be changed later, so it is created loud from the start.
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Moto requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#FF6B0A',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('save_push_token', { p_token: token, p_platform: Platform.OS, p_language: language });
    if (error) return null;
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return token;
  } catch {
    // No Firebase in this build, Expo Go, or no network: carry on without pushes.
    return null;
  }
}

/** Before signing out: this phone should stop getting this person's notifications. */
export async function unregisterPush() {
  if (!native) return;
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) await supabase.rpc('remove_push_token', { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Signing out must never fail because of this.
  }
}

/**
 * Registers while someone is signed in (again when the language changes, so pushes come in it),
 * and opens the screen a tapped notification points to.
 */
export function usePushNotifications(userId: string | null | undefined, language: string, ready: boolean) {
  useEffect(() => {
    if (userId && ready) registerForPush(language);
  }, [userId, language, ready]);

  useEffect(() => {
    if (!native || !ready || !userId) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) {
        // Wait a tick so the navigator for this role is mounted.
        setTimeout(() => router.push(url as never), 0);
      }
    };
    open(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [ready, userId]);
}
