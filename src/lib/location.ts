import * as Location from 'expo-location';

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
