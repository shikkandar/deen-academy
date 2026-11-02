import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { FirstOpenWelcome } from '@/components/welcome';
import { ProfileSetup } from '@/components/profile-setup';
import { AppStateProvider, useAppState } from '@/lib/app-state';

SplashScreen.preventAutoHideAsync();

/** The first time: name, gender and date of birth, then the welcome (and on later days whatever it shows). */
function FirstOpen() {
  const { loading, settings } = useAppState();
  if (loading) return null;
  return settings.profile ? <FirstOpenWelcome /> : <ProfileSetup />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
        <FirstOpen />
      </AppStateProvider>
    </ThemeProvider>
  );
}
