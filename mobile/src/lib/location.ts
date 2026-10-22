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

/** Asks for permission, reads the current position and caches it. Throws if permission is denied. */
export async function refreshPlace(): Promise<Place> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');

  const { coords } = await Location.getCurrentPositionAsync({});
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
