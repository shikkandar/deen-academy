import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge } from '@/components/jasmine-flower';
import { enter, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { gridItemStyle, useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { getBook } from '@/lib/hadith-books';

export default function HadithChaptersScreen() {
  const theme = useTheme();
  const t = useT();
  const { book: bookId } = useLocalSearchParams<{ book: string }>();
  const book = getBook(bookId);
  const [query, setQuery] = useState('');
  const layout = useLayout();
  const cell = gridItemStyle(layout.columns, Spacing.two);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!book || !q) return book?.sections ?? [];
    return book.sections.filter((s) => s.name.toLowerCase().includes(q) || String(s.id) === q);
  }, [book, query]);

  const back = () => (router.canDismiss() ? router.dismissTo('/hadith') : router.replace('/hadith'));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.maxWidth }]}>
        <FlatList
          // On desktop the chapters sit in a 2–3 column grid (the list remounts when the column count changes).
          key={`cols-${layout.columns}`}
          numColumns={layout.columns}
          columnWrapperStyle={layout.columns > 1 ? styles.gridRow : undefined}
          data={shown}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={[styles.list, { paddingTop: layout.topInset + Spacing.two }, layout.wide && styles.listWide]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <SpringPressable onPress={back} style={styles.back}>
                <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                  {t('‹ All books')}
                </ThemedText>
              </SpringPressable>
              <Animated.View entering={enter(0)}>
                <ThemedText style={styles.title}>{book?.name ?? 'Book not found'}</ThemedText>
                {book && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {book.total.toLocaleString()} hadith · {book.sections.length} chapters
                  </ThemedText>
                )}
              </Animated.View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('Search chapter')}
                placeholderTextColor={theme.textSecondary}
                style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
              />
            </View>
          }
          renderItem={({ item: s, index }) => (
            <Animated.View entering={index < 12 ? enter(1 + index) : undefined} style={cell}>
              <SpringPressable
                pressedScale={0.98}
                onPress={() => router.push(`/hadith/${bookId}/${s.id}`)}
                style={[styles.row, layout.wide && styles.rowWide, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <JasmineBadge value={s.id} size={40} />
                <View style={styles.rowMain}>
                  <ThemedText style={styles.bold}>{s.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Hadith {first}–{last}', { first: s.first, last: s.last })}
                  </ThemedText>
                </View>
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
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  title: { fontFamily: Fonts?.serif, fontSize: 28, lineHeight: 36, fontWeight: 600 },
  search: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three - 2, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  rowMain: { flex: 1, gap: 2 },
  bold: { fontWeight: 700 },
});
