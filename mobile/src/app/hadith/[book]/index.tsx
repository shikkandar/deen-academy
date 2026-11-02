import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookSearchButton } from '@/components/book-search';
import { JasmineBadge } from '@/components/jasmine-flower';
import { enter, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { gridItemStyle, useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useBookPlaces } from '@/lib/book-places';
import { getBook } from '@/lib/hadith-books';

export default function HadithChaptersScreen() {
  const theme = useTheme();
  const t = useT();
  const { book: bookId } = useLocalSearchParams<{ book: string }>();
  const book = getBook(bookId);
  // Where it was left in this book (saved as a chapter is read).
  const place = useBookPlaces([bookId])[bookId];
  const layout = useLayout();
  const cell = gridItemStyle(layout.columns, Spacing.two);

  // One search for the whole book (its hadith and chapter titles) sits above the chapters.
  const shown = book?.sections ?? [];

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
                <ThemedText style={styles.title}>{book ? t(book.name) : t('Book not found')}</ThemedText>
                {book && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('{n} hadith · {c} chapters', { n: book.total.toLocaleString(), c: book.sections.length })}
                  </ThemedText>
                )}
              </Animated.View>
              {book && <BookSearchButton scope={`book-${book.id}`} title={book.name} />}
              {place && (
                <SpringPressable
                  pressedScale={0.98}
                  onPress={() => router.push(place.href)}
                  style={[styles.continue, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {t('Continue reading · hadith {n}', { n: place.hadith ?? '' })}
                  </ThemedText>
                  <ThemedText style={{ color: theme.primary }}>›</ThemedText>
                </SpringPressable>
              )}
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
  continue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, paddingVertical: Spacing.three, paddingHorizontal: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  rowMain: { flex: 1, gap: 2 },
  bold: { fontWeight: 700 },
});
