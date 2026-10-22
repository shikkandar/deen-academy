import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Fonts, Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { hadithFor } from '@/lib/hadith';
import type { PrayerTime } from '@/lib/prayer';

import { JasmineFlower } from './jasmine-flower';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

/** A hadith about the given prayer — the same one for that prayer, a new one on each tap. */
export function PrayerHadithCard({ prayer }: { prayer: PrayerTime }) {
  const theme = useTheme();
  const t = useT();
  const [pick, setPick] = useState(0);
  const hadith = hadithFor(prayer.name, prayer.time.getTime(), pick);

  return (
    <SpringPressable
      pressedScale={0.98}
      onPress={() => setPick((p) => p + 1)}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <JasmineFlower size={18} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {t('HADITH · {name}', { name: t(prayer.name).toUpperCase() })}
        </ThemedText>
      </View>

      {/* Keyed so each new hadith fades in. */}
      <Animated.View key={hadith.id} entering={FadeIn.duration(450)} exiting={FadeOut.duration(200)} style={styles.body}>
        <ThemedText style={[styles.quote, { color: theme.gold }]}>“</ThemedText>
        <ThemedText style={styles.text}>{hadith.text}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.reference}>
          {hadith.narrator ? `${t('Narrated by {name}', { name: hadith.narrator })} · ` : ''}Sahih al-Bukhari {hadith.hadithNumber}
        </ThemedText>
      </Animated.View>

      <ThemedText type="small" style={[styles.hint, { color: theme.primary }]}>
        {t('Tap for another')}
      </ThemedText>
    </SpringPressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { letterSpacing: 1.5 },
  body: { gap: Spacing.two },
  quote: { fontFamily: Fonts?.serif, fontSize: 44, lineHeight: 40, fontWeight: 700, marginBottom: -Spacing.two },
  text: { fontFamily: Fonts?.serif, fontSize: 17, lineHeight: 26 },
  reference: { fontStyle: 'italic' },
  hint: { textAlign: 'right', fontWeight: 600 },
});
