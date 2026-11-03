import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { FirstOpenWelcome } from '@/components/welcome';
import { LanguagePrompt } from '@/components/language-choice';
import { ProfileSetup } from '@/components/profile-setup';
import { AppStateProvider, useAppState } from '@/lib/app-state';

SplashScreen.preventAutoHideAsync();

/**
 * The first time: language, name, gender and date of birth, then the welcome (and on later days whatever it shows).
 * People who set up the app before the language was asked get a one-time language popup first.
 */
function FirstOpen() {
  const { loading, settings } = useAppState();
  if (loading) return null;
  if (!settings.profile) return <ProfileSetup />;
  if (!settings.languageAsked) return <LanguagePrompt />;
  return <FirstOpenWelcome />;
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
