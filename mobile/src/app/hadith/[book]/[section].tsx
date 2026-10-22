import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge } from '@/components/jasmine-flower';
import { enter, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { getBook, getChapter, isOurTamil, type Hadith } from '@/lib/hadith-books';
import { saveHadithProgress } from '@/lib/reading-progress';

export default function HadithChapterScreen() {
  const theme = useTheme();
  const t = useT();
  const tamil = useAppState().settings.language === 'ta';
  // `at` is set when opened from "Continue reading".
  const { book: bookId, section, at } = useLocalSearchParams<{ book: string; section: string; at?: string }>();
  const book = getBook(bookId);
  const sectionId = Number(section);
  const chapter = book?.sections.find((s) => s.id === sectionId);

  const [hadiths, setHadiths] = useState<Hadith[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () =>
    getChapter(bookId, sectionId)
      .then(setHadiths)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per chapter
  }, [bookId, sectionId]);
  // Remember the hadith at the top of the screen, so "Continue reading" brings her back here.
  const listRef = useRef<FlatList<Hadith>>(null);
  const meta = useRef({ bookId, bookName: book?.name ?? '', sectionId, chapterName: chapter?.name ?? '' });
  useEffect(() => {
    meta.current = { bookId, bookName: book?.name ?? '', sectionId, chapterName: chapter?.name ?? '' };
  }, [bookId, book, sectionId, chapter]);
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { item: Hadith; index?: number | null; isViewable: boolean }[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (!first?.item || first.index == null) return;
    const m = meta.current;
    saveHadithProgress({
      book: m.bookId,
      bookName: m.bookName,
      section: m.sectionId,
      chapterName: m.chapterName,
      index: first.index,
      hadithNumber: first.item.number,
    });
  });
  const [viewability] = useState({ itemVisiblePercentThreshold: 40 });

  // Opened from "Continue reading": scroll to that hadith once the chapter has loaded.
  useEffect(() => {
    const index = Number(at);
    if (!hadiths || !index) return;
    const t = setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.05, animated: true }), 350);
    return () => clearTimeout(t);
  }, [hadiths, at]);

  const retry = () => {
    setError(null);
    fetchData();
  };

  const back = () => {
    const target = (book && book.sections.length > 1 ? `/hadith/${bookId}` : '/hadith') as Href;
    if (router.canDismiss()) router.dismissTo(target);
    else router.replace(target);
  };

  // Previous / next chapter, like the Quran's previous / next surah.
  const idx = book?.sections.findIndex((s) => s.id === sectionId) ?? -1;
  const prev = idx > 0 ? book!.sections[idx - 1] : null;
  const next = book && idx >= 0 && idx + 1 < book.sections.length ? book.sections[idx + 1] : null;
  const goTo = (id: number) => router.replace(`/hadith/${bookId}/${id}`);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          ref={listRef}
          data={hadiths ?? []}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          onScrollToIndexFailed={({ index }) =>
            setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.05, animated: true }), 250)
          }
          keyExtractor={(h) => String(h.number)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <SpringPressable onPress={back} style={styles.back}>
                <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                  {book && book.sections.length > 1 ? t('‹ Chapters') : t('‹ All books')}
                </ThemedText>
              </SpringPressable>

              <Animated.View entering={enter(0)} style={[styles.hero, { backgroundColor: theme.hero }]}>
                <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                  {book?.name}
                </ThemedText>
                <ThemedText style={[styles.heroTitle, { color: theme.onHero }]}>{chapter?.name ?? 'Chapter'}</ThemedText>
                {chapter && (
                  <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                    {t('Hadith {first}–{last}', { first: chapter.first, last: chapter.last })}
                  </ThemedText>
                )}
              </Animated.View>

              {tamil && isOurTamil(bookId) && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
                  {t('Tamil: Deen Academy translation, made with AI help from the Arabic. Not yet checked by a scholar.')}
                </ThemedText>
              )}

              {!hadiths && !error && <ActivityIndicator color={theme.primary} style={styles.loading} />}
              {error && (
                <SpringPressable onPress={retry} style={[styles.errorBox, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {error} {t('Tap to retry.')}
                  </ThemedText>
                </SpringPressable>
              )}
            </View>
          }
          ListFooterComponent={
            hadiths ? (
              <View style={styles.nav}>
                {prev ? (
                  <SpringPressable pressedScale={0.95} onPress={() => goTo(prev.id)} style={[styles.navPill, { borderColor: theme.border }]}>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      ‹ {prev.name}
                    </ThemedText>
                  </SpringPressable>
                ) : (
                  <View />
                )}
                {next && (
                  <SpringPressable
                    pressedScale={0.95}
                    onPress={() => goTo(next.id)}
                    style={[styles.navPill, { backgroundColor: theme.primarySoft, borderColor: 'transparent' }]}>
                    <ThemedText type="small" style={[styles.bold, { color: theme.primary }]} numberOfLines={1}>
                      {next.name} ›
                    </ThemedText>
                  </SpringPressable>
                )}
              </View>
            ) : undefined
          }
          renderItem={({ item: h, index }) => (
            <Animated.View
              entering={index < 6 ? FadeInDown.springify().damping(18).delay(120 + index * 60) : FadeIn}
              style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.cardTop}>
                <JasmineBadge value={h.number} size={42} />
                {h.grade && (
                  <View style={[styles.grade, { backgroundColor: theme.petalSoft }]}>
                    <ThemedText type="small" style={{ color: theme.primary }} numberOfLines={1}>
                      {h.grade}
                    </ThemedText>
                  </View>
                )}
              </View>
              {!!h.arabic && <ThemedText style={styles.arabic}>{h.arabic}</ThemedText>}
              {!!h.arabic && <View style={[styles.divider, { backgroundColor: theme.gold }]} />}
              {h.narrator && (
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {t('Narrated by {name}', { name: h.narrator })}
                </ThemedText>
              )}
              <ThemedText style={styles.english}>{tamil && h.tamil ? h.tamil : h.english}</ThemedText>
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
  bold: { fontWeight: 700 },
  credit: { textAlign: 'center' },
  list: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingTop: TopTabInset + Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  headerBlock: { gap: Spacing.three },
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  heroTitle: { fontFamily: Fonts?.serif, fontSize: 24, lineHeight: 30, fontWeight: 600, textAlign: 'center' },
  loading: { paddingVertical: Spacing.five },
  errorBox: { borderRadius: 16, padding: Spacing.three },
  card: { borderWidth: 1, borderRadius: 24, padding: Spacing.three + Spacing.one, gap: Spacing.two + Spacing.one },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  grade: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: Spacing.two, maxWidth: '70%' },
  arabic: { fontSize: 22, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl' },
  divider: { height: 1.5, width: 36, borderRadius: 1, opacity: 0.7, alignSelf: 'center' },
  english: { fontSize: 15, lineHeight: 23 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  navPill: { borderWidth: 1, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, maxWidth: '48%' },
});
