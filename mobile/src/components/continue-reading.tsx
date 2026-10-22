import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { hadithHref, quranHref, timeAgo, useProgress } from '@/lib/reading-progress';

import { JasmineFlower } from './jasmine-flower';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

function Card({ label, title, detail, onPress }: { label: string; title: string; detail: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <SpringPressable pressedScale={0.98} onPress={onPress} style={[styles.card, { backgroundColor: theme.primarySoft }]}>
      <JasmineFlower size={22} />
      <View style={styles.text}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {label}
        </ThemedText>
        <ThemedText style={[styles.title, { color: theme.primary }]} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
      <ThemedText style={[styles.title, { color: theme.primary }]}>›</ThemedText>
    </SpringPressable>
  );
}

/** "Continue reading" for the Quran — nothing until she has opened a surah. */
export function ContinueQuran() {
  const p = useProgress('quran');
  const t = useT();
  if (!p) return null;
  return (
    <Card
      label={t('CONTINUE READING · QURAN')}
      title={p.surahName}
      detail={`${t('Ayah {ayah} of {total}', { ayah: p.ayah, total: p.total })} · ${timeAgo(p.at, t)}`}
      onPress={() => router.push(quranHref(p))}
    />
  );
}

/** "Continue reading" for Hadith — nothing until she has opened a chapter. */
export function ContinueHadith() {
  const p = useProgress('hadith');
  const t = useT();
  if (!p) return null;
  return (
    <Card
      label={t('CONTINUE READING · HADITH')}
      title={`${p.bookName} · ${p.hadithNumber}`}
      detail={`${p.chapterName} · ${timeAgo(p.at, t)}`}
      onPress={() => router.push(hadithHref(p))}
    />
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: 20, padding: Spacing.three },
  text: { flex: 1, gap: 1 },
  label: { letterSpacing: 1.2, fontSize: 11 },
  title: { fontWeight: 700 },
});
