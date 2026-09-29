import * as Location from 'expo-location';
import { Linking } from 'react-native';

export type Coords = { lat: number; lng: number };

/** Asks for location permission if needed and returns the current position, or null if it isn't available. */
export async function currentPosition(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({});
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Phones are stored as digits with the country code, e.g. 252634740002. */
const digitsOf = (phone: string) => phone.replace(/\D/g, '');

export function callPhone(phone: string) {
  return Linking.openURL(`tel:+${digitsOf(phone)}`);
}

export function openWhatsApp(phone: string) {
  return Linking.openURL(`https://wa.me/${digitsOf(phone)}`);
}
