import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

// Light, dark, or follow the phone. Saved on the device and applied app-wide through Appearance, so
// useColorScheme() (and with it every screen's theme) follows the choice.
export type AppearanceChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'jareeye.appearance';
let current: AppearanceChoice = 'system';
const listeners = new Set<() => void>();

function apply(choice: AppearanceChoice) {
  current = choice;
  Appearance.setColorScheme(choice === 'system' ? 'unspecified' : choice);
  listeners.forEach((l) => l());
}

/** Applies the saved choice. Called once when the app starts. */
export async function loadAppearance() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') apply(saved);
  } catch {
    // Storage unavailable: keep following the phone.
  }
}

export function setAppearance(choice: AppearanceChoice) {
  apply(choice);
  AsyncStorage.setItem(STORAGE_KEY, choice).catch(() => {});
}

export function useAppearance() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
