import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { NamazAssistant } from '@/components/namaz-assistant';
import { ThemedView } from '@/components/themed-view';
import { useAppState } from '@/lib/app-state';
import { getNextPrayer, getPrayerWindow } from '@/lib/prayer';

// The Namaz Assistant as a tab in the apps (Android allows five tabs, so Settings moved to the ⚙ on Prayers).
// It opens whenever the tab is chosen; closing it goes back to Prayers.
export default function NamazTab() {
  const { place, settings } = useAppState();
  const [open, setOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setOpen(true);
      return () => setOpen(false);
    }, []),
  );

  // The prayer whose time is still running (Isha until Fajr), else the next one — as on the Prayers screen.
  const now = new Date();
  const prayer = place ? (getPrayerWindow(place, settings, now)?.prayer.name ?? getNextPrayer(place, settings, now).name) : 'Fajr';

  return (
    <ThemedView style={{ flex: 1 }}>
      <NamazAssistant
        prayer={prayer}
        visible={open}
        onClose={() => {
          setOpen(false);
          router.navigate('/');
        }}
      />
    </ThemedView>
  );
}
