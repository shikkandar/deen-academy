import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, Linking, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ANDROID_APK_URL, ANDROID_APP_VERSION } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';

import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

const DISMISSED_KEY = 'web.androidCardDismissed';

/**
 * Web only, narrow windows (phones in a browser): a card inviting her to install the Android app. Hidden in the
 * native apps, on desktop (the sidebar has the download), while there's no download link, and once dismissed.
 */
export function AndroidAppCard() {
  const theme = useTheme();
  const t = useT();
  const { wide } = useLayout();
  const enabled = Platform.OS === 'web' && !!ANDROID_APK_URL && !wide;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => setDismissed(v === '1'))
      .catch(() => setDismissed(false));
  }, [enabled]);

  if (!enabled || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {});
  };

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.card, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
      <View style={styles.top}>
        <View style={styles.logoTile}>
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} />
        </View>
        <ThemedText type="small" style={styles.text}>
          {t('Deen Academy for Android — Azan alarms, Qibla camera and offline Quran & Hadith work best in the app.')}
        </ThemedText>
        <SpringPressable accessibilityLabel={t('Dismiss')} onPress={dismiss} style={styles.close}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </SpringPressable>
      </View>
      <View style={styles.bottom}>
        <SpringPressable onPress={() => Linking.openURL(ANDROID_APK_URL)} style={[styles.button, { backgroundColor: theme.primary }]}>
          <ThemedText type="small" style={[styles.bold, { color: theme.onPrimary }]}>
            {t('Download')}
          </ThemedText>
        </SpringPressable>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Android · v{version} · free', { version: ANDROID_APP_VERSION })}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two + 2 },
  text: { flex: 1 },
  logoTile: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F1E3' },
  logo: { width: 24, height: 24 },
  close: { paddingHorizontal: Spacing.one, marginTop: -2 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  button: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  bold: { fontWeight: 700 },
});
