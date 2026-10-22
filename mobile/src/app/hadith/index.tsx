import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinueHadith } from '@/components/continue-reading';
import { JasmineBadge } from '@/components/jasmine-flower';
import { enter, FloatingFlower, SpringPressable } from '@/components/motion';
import { SearchIcon } from '@/components/search-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { BOOKS, hasTamil, type Book } from '@/lib/hadith-books';

function openBook(book: Book) {
  // The 40-hadith collections have a single chapter — go straight to it.
  if (book.sections.length === 1) router.push(`/hadith/${book.id}/${book.sections[0].id}`);
  else router.push(`/hadith/${book.id}`);
}

export default function HadithBooksScreen() {
  const theme = useTheme();
  const t = useT();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={BOOKS}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <Animated.View entering={enter(0)} style={styles.header}>
                <ThemedText style={styles.title}>{t('Hadith')}</ThemedText>
                <FloatingFlower size={30} rotate={20} period={30} />
              </Animated.View>
              <Animated.View entering={enter(1)}>
                <SpringPressable
                  pressedScale={0.98}
                  onPress={() => router.push('/hadith/search')}
                  style={[styles.searchPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <SearchIcon size={18} color={theme.textSecondary} />
                  <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.searchText}>
                    {t('Search hadith')}
                  </ThemedText>
                </SpringPressable>
              </Animated.View>
              <ContinueHadith />
              <Animated.View entering={enter(1)}>
                <SpringPressable
                  pressedScale={0.98}
                  onPress={() => router.push('/hadith/muntakhab')}
                  style={[styles.row, { backgroundColor: theme.primarySoft, borderColor: theme.primarySoft }]}>
                  <JasmineBadge value="★" size={44} />
                  <View style={styles.rowMain}>
                    <ThemedText style={[styles.bold, { color: theme.primary }]}>Muntakhab Ahadith</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('Six qualities · Tamil and English · offline')}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.chevron, { color: theme.primary }]}>›</ThemedText>
                </SpringPressable>
              </Animated.View>
            </View>
          }
          renderItem={({ item: b, index }) => (
            <Animated.View entering={enter(1 + index)}>
              <SpringPressable
                pressedScale={0.98}
                onPress={() => openBook(b)}
                style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <JasmineBadge value={index + 1} size={44} />
                <View style={styles.rowMain}>
                  <ThemedText style={styles.bold}>{b.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('{n} hadith', { n: b.total.toLocaleString() })}
                    {b.sections.length > 1 ? t(' · {n} chapters', { n: b.sections.length }) : ''}
                    {hasTamil(b.id) ? t(' · Tamil') : ''}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.chevron, { color: theme.primary }]}>›</ThemedText>
              </SpringPressable>
            </Animated.View>
          )}
          ListFooterComponent={
            <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
              {t('Arabic and English, with Tamil where marked')}
            </ThemedText>
          }
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
    paddingTop: TopTabInset + Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  headerBlock: { gap: Spacing.three, paddingBottom: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontFamily: Fonts?.serif, fontSize: 34, lineHeight: 42, fontWeight: 600 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  rowMain: { flex: 1, gap: 2 },
  bold: { fontWeight: 700 },
  chevron: { fontSize: 24, lineHeight: 28 },
  source: { textAlign: 'center', paddingTop: Spacing.three },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  searchText: { flex: 1, fontSize: 16 },
});
