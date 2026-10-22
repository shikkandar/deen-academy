import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinueQuran } from '@/components/continue-reading';
import { JasmineBadge } from '@/components/jasmine-flower';
import { enter, FloatingFlower, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { gridItemStyle, useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { getSurahList, type SurahInfo } from '@/lib/quran';

export default function QuranScreen() {
  const theme = useTheme();
  const t = useT();
  const [surahs, setSurahs] = useState<SurahInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const layout = useLayout();
  const cell = gridItemStyle(layout.columns, Spacing.two);

  const fetchData = () =>
    getSurahList()
      .then(setSurahs)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    fetchData();
  }, []);
  const load = () => {
    setError(null);
    fetchData();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[-'\s]/g, '');
    if (!surahs || !q) return surahs ?? [];
    return surahs.filter(
      (s) =>
        String(s.number) === q ||
        s.englishName.toLowerCase().replace(/[-'\s]/g, '').includes(q) ||
        s.englishNameTranslation.toLowerCase().replace(/\s/g, '').includes(q),
    );
  }, [surahs, query]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.maxWidth }]}>
        <FlatList
          // On desktop the surahs sit in a 2–3 column grid (the list remounts when the column count changes).
          key={`cols-${layout.columns}`}
          numColumns={layout.columns}
          columnWrapperStyle={layout.columns > 1 ? styles.gridRow : undefined}
          data={shown}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={[styles.list, { paddingTop: layout.topInset + Spacing.three }, layout.wide && styles.listWide]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Animated.View entering={enter(0)} style={styles.header}>
                <ThemedText style={styles.title}>{t('Quran')}</ThemedText>
                <FloatingFlower size={30} rotate={20} period={30} />
              </Animated.View>
              <Animated.View entering={enter(1)}>
                <ContinueQuran />
              </Animated.View>
              <Animated.View entering={enter(1)}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('Search surah — name or number')}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                />
              </Animated.View>
              {!surahs && !error && <ActivityIndicator color={theme.primary} style={styles.loading} />}
              {error && (
                <SpringPressable onPress={load} style={[styles.errorBox, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {error} {t('Tap to retry.')}
                  </ThemedText>
                </SpringPressable>
              )}
            </View>
          }
          renderItem={({ item: s, index }) => (
            <Animated.View entering={index < 12 ? enter(2 + index) : undefined} style={cell}>
              <SpringPressable
                pressedScale={0.98}
                onPress={() => router.push(`/quran/${s.number}`)}
                style={[styles.row, layout.wide && styles.rowWide, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <JasmineBadge value={s.number} size={44} />
                <View style={styles.rowMain}>
                  <ThemedText style={styles.bold}>{s.englishName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {s.englishNameTranslation} · {t('{n} ayahs', { n: s.numberOfAyahs })} · {t(s.revelationType)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.arabicName, { color: theme.primary }]}>{s.name.replace(/^سُورَةُ\s*/, '')}</ThemedText>
              </SpringPressable>
            </Animated.View>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  list: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  listWide: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.five },
  gridRow: { gap: Spacing.two },
  rowWide: { flex: 1, cursor: 'pointer' },
  headerBlock: { gap: Spacing.three, paddingBottom: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontFamily: Fonts?.serif, fontSize: 34, lineHeight: 42, fontWeight: 600 },
  search: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three - 2, fontSize: 16 },
  loading: { paddingVertical: Spacing.five },
  errorBox: { borderRadius: 16, padding: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  rowMain: { flex: 1, gap: 2 },
  bold: { fontWeight: 700 },
  arabicName: { fontSize: 22, lineHeight: 34 },
});
