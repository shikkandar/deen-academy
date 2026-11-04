import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import type { Coords } from './prayer';

export type Place = Coords & { city: string | null };

const KEY = 'place.v1';

export async function loadCachedPlace(): Promise<Place | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export type LocationPermission = 'granted' | 'undetermined' | 'denied' | 'blocked';

export async function getLocationPermission(): Promise<LocationPermission> {
  const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return canAskAgain ? 'denied' : 'blocked';
}

const FIX_TIMEOUT_MS = 15_000;

/** A fresh GPS fix, but never stuck on "Finding your location…": indoors a fix can take minutes or never come, so after
 *  15 s it settles for the phone's last known position (a few minutes or km off changes the times by a minute at most). */
async function currentPosition() {
  const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
  const fix = await Promise.race([fresh.catch(() => null), timeout]);
  if (fix) return fix;
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  if (last) return last;
  return fresh; // nothing known yet: keep waiting for the real fix (or its error)
}

/** Asks for permission, reads the current position and caches it. Throws if permission is denied. */
export async function refreshPlace(): Promise<Place> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const { coords } = await currentPosition();
  let city: string | null = null;
  try {
    const [address] = await Location.reverseGeocodeAsync(coords);
    city = address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? null;
  } catch {
    // City name is only for display; prayer times work without it.
  }

  const place: Place = { latitude: coords.latitude, longitude: coords.longitude, city };
  await AsyncStorage.setItem(KEY, JSON.stringify(place));
  return place;
}
