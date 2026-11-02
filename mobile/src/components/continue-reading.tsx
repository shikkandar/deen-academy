import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { hadithHref, quranHref, timeAgo, useRecent } from '@/lib/reading-progress';

import { HistoryIcon } from './history-icon';
import { JasmineFlower } from './jasmine-flower';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

type Item = { key: string; title: string; detail: string; href: Href };

/** The latest place, with a history button that opens the ones before it, each opening where she was. */
function Card({ label, items }: { label: string; items: Item[] }) {
  const theme = useTheme();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [latest, ...earlier] = items;
  return (
    <View style={[styles.card, { backgroundColor: theme.primarySoft }]}>
      <View style={styles.latestRow}>
        <SpringPressable pressedScale={0.98} onPress={() => router.push(latest.href)} style={styles.latest}>
          <JasmineFlower size={22} />
          <View style={styles.text}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {label}
            </ThemedText>
            <ThemedText style={[styles.title, { color: theme.primary }]} numberOfLines={1}>
              {latest.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {latest.detail}
            </ThemedText>
          </View>
          <ThemedText style={[styles.title, { color: theme.primary }]}>›</ThemedText>
        </SpringPressable>
        {earlier.length > 0 && (
          <SpringPressable
            accessibilityRole="button"
            accessibilityLabel={open ? t('Hide recently read') : t('Recently read')}
            pressedScale={0.9}
            hitSlop={8}
            onPress={() => setOpen((o) => !o)}
            style={[styles.historyBtn, { backgroundColor: open ? theme.primary : theme.backgroundElement }]}>
            <HistoryIcon size={18} color={open ? theme.onPrimary : theme.primary} />
          </SpringPressable>
        )}
      </View>
      {open &&
        earlier.map((item) => (
          <Animated.View key={item.key} entering={FadeIn.duration(180)}>
            <SpringPressable
              pressedScale={0.98}
              onPress={() => router.push(item.href)}
              style={[styles.earlier, { borderTopColor: theme.border }]}>
              <View style={styles.text}>
                <ThemedText type="small" style={[styles.bold, { color: theme.primary }]} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.detail}
                </ThemedText>
              </View>
              <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                ›
              </ThemedText>
            </SpringPressable>
          </Animated.View>
        ))}
    </View>
  );
}

/** "Continue reading" for the Quran — nothing until she has read a surah. */
export function ContinueQuran() {
  const recent = useRecent('quran');
  const t = useT();
  if (!recent.length) return null;
  return (
    <Card
      label={t('CONTINUE READING · QURAN')}
      items={recent.map((p) => ({
        key: String(p.surah),
        title: p.surahName,
        detail: `${t('Ayah {ayah} of {total}', { ayah: p.ayah, total: p.total })} · ${timeAgo(p.at, t)}`,
        href: quranHref(p),
      }))}
    />
  );
}

/** "Continue reading" for Hadith — nothing until she has read a chapter. */
export function ContinueHadith() {
  const recent = useRecent('hadith');
  const t = useT();
  if (!recent.length) return null;
  return (
    <Card
      label={t('CONTINUE READING · HADITH')}
      items={recent.map((p) => ({
        key: `${p.book}/${p.section}`,
        title: `${p.bookName} · ${p.hadithNumber}`,
        detail: `${p.chapterName} · ${timeAgo(p.at, t)}`,
        href: hadithHref(p),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  latestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  latest: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  historyBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  earlier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginLeft: 22 + Spacing.three, // lined up with the text above, past the flower
  },
  text: { flex: 1, gap: 1 },
  label: { letterSpacing: 1.2, fontSize: 11 },
  title: { fontWeight: 700 },
  bold: { fontWeight: 700 },
});
