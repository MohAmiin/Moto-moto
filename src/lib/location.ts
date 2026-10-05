import * as Location from 'expo-location';

import { withTimeout } from '@/lib/rider-availability';

export type Coords = { lat: number; lng: number };

// A GPS fix can take a long time indoors; after this the last known position is used instead.
const FIX_TIMEOUT_MS = 12_000;
// A last known position older than this is too stale to show customers.
const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

export type LocationResult =
  | { status: 'ok'; coords: Coords }
  /** Permission refused. `canAskAgain` false means only the phone's Settings can change it. */
  | { status: 'denied'; canAskAgain: boolean }
  /** Permission given but no position (location services off, or no fix in time). */
  | { status: 'unavailable' };

/** Asks for location permission if needed and returns the current position, or why there is none. */
export async function currentLocation(): Promise<LocationResult> {
  try {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { status: 'denied', canAskAgain };
    const fix = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(toCoords),
      FIX_TIMEOUT_MS,
      null,
    );
    if (fix) return { status: 'ok', coords: fix };
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    return last ? { status: 'ok', coords: toCoords(last) } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * A recent position for a rider who is online, or null. Never waits longer than about 12 seconds:
 * if the GPS is slow it falls back to a position from the last two minutes.
 * `ask` shows the permission prompt when needed (when going online); the 30-second updates don't ask.
 */
export async function riderPosition(ask: boolean): Promise<Coords | null> {
  try {
    const { status } = ask
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const fix = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(toCoords),
      FIX_TIMEOUT_MS,
      null,
    );
    if (fix) return fix;

    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    return last ? toCoords(last) : null;
  } catch {
    return null;
  }
}

function toCoords(pos: Location.LocationObject): Coords {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
