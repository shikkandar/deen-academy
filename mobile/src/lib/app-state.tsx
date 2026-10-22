import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, NativeModules, Platform } from 'react-native';

import {
  hasDndAccess,
  isDndSupported,
  isIgnoringBatteryOptimizations,
  openDndAccessSettings,
  requestIgnoreBatteryOptimizations,
} from '../../modules/prayer-dnd';
import { playSource } from './audio-focus';
import { scheduleDnd } from './dnd';
import { getLocationPermission, loadCachedPlace, refreshPlace, type LocationPermission, type Place } from './location';
import { cancelFajrWake, requestNotificationPermission, schedulePrayerNotifications } from './notifications';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';

const BATTERY_ASKED = 'asked.batteryOptimization.v1';

const AZAN_SOURCES = {
  full: require('@/assets/sounds/azan.wav'),
  short: require('@/assets/sounds/azan_short.wav'),
  fajrFull: require('@/assets/sounds/azan_fajr.wav'),
  fajrShort: require('@/assets/sounds/azan_fajr_short.wav'),
};

type AppStateValue = {
  place: Place | null;
  settings: Settings;
  locationPermission: LocationPermission | null;
  error: string | null;
  loading: boolean;
  dndSupported: boolean;
  dndAccess: boolean;
  requestLocation: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  openDndSettings: () => void;
};

const Ctx = createContext<AppStateValue | null>(null);

/**
 * Stops the Azan when a volume button is pressed. We only listen — the volume itself is never changed.
 * Needs the native volume module, so it does nothing in Expo Go or on web.
 */
function useStopOnVolumeButton(playing: boolean, stop: () => void) {
  useEffect(() => {
    if (!playing || Platform.OS === 'web' || !NativeModules.VolumeManager) return;
    // Lazy so Expo Go / web never load the missing native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { VolumeManager } = require('react-native-volume-manager') as typeof import('react-native-volume-manager');
    const sub = VolumeManager.addVolumeListener(() => stop());
    return () => sub.remove();
  }, [playing, stop]);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [place, setPlace] = useState<Place | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [locationPermission, setLocationPermission] = useState<LocationPermission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dndAccess, setDndAccess] = useState(hasDndAccess());

  // Quran and duas keep playing with the screen off or the app in the background (like a music app).
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
  }, []);

  const player = useAudioPlayer();
  const { playing } = useAudioPlayerStatus(player);

  // A recording she picked for this length plays instead of the built-in one.
  const customAzanRef = useRef<Settings['customAzan']>({ full: null, short: null });
  const playAzan = useCallback(
    (fajr: boolean, length: Settings['azanLength']) => {
      const custom = customAzanRef.current[length];
      const key = fajr ? (length === 'short' ? 'fajrShort' : 'fajrFull') : length;
      playSource(player, custom ? { uri: custom.uri } : AZAN_SOURCES[key]);
    },
    [player],
  );
  useEffect(() => {
    customAzanRef.current = settings.customAzan;
  }, [settings.customAzan]);
  const stopAzan = useCallback(() => player.pause(), [player]);
  useStopOnVolumeButton(playing, stopAzan);

  const refreshLocation = useCallback(async () => {
    try {
      setPlace(await refreshPlace());
      setLocationPermission('granted');
      setError(null);
    } catch (e) {
      setLocationPermission(await getLocationPermission());
      setError(e instanceof Error ? e.message : 'Could not get location');
    }
  }, []);

  /** Shows the system permission dialog, or opens app settings if Android won't ask again. */
  const requestLocation = useCallback(async () => {
    if ((await getLocationPermission()) === 'blocked') {
      await Linking.openSettings();
      return;
    }
    await refreshLocation();
  }, [refreshLocation]);

  // First load: cached values straight away. We only fetch location silently if permission was
  // already given — otherwise the Home screen explains why and asks.
  useEffect(() => {
    (async () => {
      const [cached, saved, permission] = await Promise.all([loadCachedPlace(), loadSettings(), getLocationPermission()]);
      setSettings(saved);
      if (cached) setPlace(cached);
      setLocationPermission(permission);
      setLoading(false);
      await requestNotificationPermission().catch(() => {}); // not supported on web
      // Battery saving makes many phones delay or skip the Fajr Azan: ask once to be left out of it.
      if (!isIgnoringBatteryOptimizations() && !(await AsyncStorage.getItem(BATTERY_ASKED))) {
        await AsyncStorage.setItem(BATTERY_ASKED, '1');
        requestIgnoreBatteryOptimizations();
      }
      if (permission === 'granted') await refreshLocation();
    })();
  }, [refreshLocation]);

  // Coming back from system settings: pick up newly granted location / DND access.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      setDndAccess(hasDndAccess());
      if (!place && (await getLocationPermission()) === 'granted') refreshLocation();
    });
    return () => sub.remove();
  }, [place, refreshLocation]);

  // Reschedule notifications and DND whenever location, settings or DND access change,
  // and each time the app comes back to the foreground.
  useEffect(() => {
    if (!place) return;
    const reschedule = () => {
      schedulePrayerNotifications(place, settings).catch(() => {});
      scheduleDnd(place, settings);
    };
    reschedule();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reschedule();
    });
    return () => sub.remove();
  }, [place, settings, dndAccess]);

  // Tapping the Quran reminder opens the Quran tab.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data;
      if (data?.url === '/quran') router.push('/quran');
      if (data?.kind === 'wake' && typeof data.fajrAt === 'number') cancelFajrWake(data.fajrAt).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // If the app is open at Azan time, play the full Azan in-app.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data;
      if (data?.kind === 'azan' && settings.playAzan && AppState.currentState === 'active') playAzan(data.prayer === 'Fajr', settings.azanLength);
    });
    return () => sub.remove();
  }, [settings.playAzan, settings.azanLength, playAzan]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
    },
    [settings],
  );

  return (
    <Ctx.Provider
      value={{
        place,
        settings,
        locationPermission,
        error,
        loading,
        dndSupported: isDndSupported,
        dndAccess,
        requestLocation,
        refreshLocation,
        updateSettings,
        openDndSettings: openDndAccessSettings,
      }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
