import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge, JasmineFlower } from '@/components/jasmine-flower';
import { enter, FloatingFlower, SpringPressable } from '@/components/motion';
import { SahabaLangSwitch } from '@/components/sahaba-lang';
import { BookSearchButton } from '@/components/book-search';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { useT } from '@/hooks/use-t';
import { timeAgo } from '@/lib/reading-progress';
import { chapterOf, hasPage, LANG_DETAIL, loadLang, pageLabel, pagesIn, printedPage, samePages, saveLang, tocFor, useLastPage, volumeFor, volumeOf, type SLang } from '@/lib/sahaba';

const pageHref = (n: number, lang: SLang, vol: number | null) => `/hadith/sahaba/${n}?lang=${lang}${vol ? `&vol=${vol}` : ''}` as Href;
const AR_VOL = ['', 'الجزء الأول', 'الجزء الثاني', 'الجزء الثالث', 'الجزء الرابع'];

/** Hayatus Sahaba: contents by chapter, "continue reading", and how much of the book is in the app so far. */
export default function SahabaContents() {
  const theme = useTheme();
  const t = useT();
  // Each of the four volumes of the Arabic original is its own book on the shelf (?vol=1…4).
  const { vol: volParam } = useLocalSearchParams<{ vol?: string }>();
  const book = Math.min(Math.max(Number(volParam) || 1, 1), 4);
  const layout = useLayout();
  const appLang = useAppState().settings.language;
  const [lang, setLang] = useState<SLang>(appLang);
  const [open, setOpen] = useState<number | null>(null);
  const last = useLastPage(book);
  useEffect(() => {
    loadLang(appLang).then(setLang);
  }, [appLang]);
  const changeLang = (l: SLang) => {
    setLang(l);
    saveLang(l);
    setOpen(null);
  };
  const vol = volumeFor(lang, book);
  const toc = tocFor(lang, book);
  const ready = pagesIn(lang, book).length;
  const total = Math.max(toc.total || 0, ready);
  const lastHere =
    last && hasPage(last.page, lang) && samePages(last.lang, lang) && (!vol || volumeOf(last.page) === vol) ? last : null;
  const lastChapter = lastHere ? chapterOf(lastHere.page, lang) : null;
  const first = pagesIn(lang, book)[0];
  // Chapters with no page ready yet are left out of the count of ready topics, and their topics are dimmed.
  const chapters = toc.chapters.map((c) => ({ ...c, ready: c.items.filter((i) => hasPage(i.page, lang)).length }));

  const back = () => {
    if (router.canDismiss()) router.dismissTo('/hadith');
    else router.replace('/hadith');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.readingWidth }]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: layout.topInset + Spacing.two }]} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <SpringPressable onPress={back} style={styles.back}>
              <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                ‹ {t('All books')}
              </ThemedText>
            </SpringPressable>
            <SahabaLangSwitch value={lang} onChange={changeLang} />
          </View>

          <BookSearchButton scope={`sahaba-${book}`} title={t('Hayatus Sahaba · Vol {n}', { n: book })} />

          <Animated.View entering={enter(0)} style={[styles.hero, { backgroundColor: theme.hero }]}>
            <FloatingFlower size={90} rotate={18} period={50} style={[styles.heroFlower, { opacity: 0.14 }]} />
            <ThemedText style={[styles.heroArabic, { color: theme.onHero }]}>حَيَاةُ الصَّحَابَة</ThemedText>
            <ThemedText style={[styles.heroTitle, { color: theme.onHero }]}>{lang === 'en' ? 'Hayatus Sahaba' : lang === 'ar' ? 'حياة الصحابة' : 'ஹயாத்துஸ் ஸஹாபா'}</ThemedText>
            {!!vol && (
              <ThemedText style={[styles.bold, { color: theme.onHero }]}>{lang === 'ar' ? AR_VOL[vol] : `பாகம் ${vol}`}</ThemedText>
            )}
            <ThemedText type="small" style={[styles.center, { color: theme.onHeroMuted }]}>
              {LANG_DETAIL[lang]}
            </ThemedText>
            {first != null && (
              <SpringPressable
                onPress={() => router.push(pageHref(lastHere?.page ?? first, lang, vol))}
                style={[styles.heroBtn, { backgroundColor: theme.onHero }]}>
                <ThemedText type="small" style={[styles.bold, { color: theme.hero }]}>
                  {lastHere ? t('Continue · {page}', { page: pageLabel(lastHere.page, lang) }) : t('Start reading')}
                </ThemedText>
              </SpringPressable>
            )}
            {lastHere && lastChapter && (
              <ThemedText type="small" style={{ color: theme.onHeroMuted }} numberOfLines={1}>
                {lastChapter.item} · {timeAgo(lastHere.at)}
              </ThemedText>
            )}
          </Animated.View>

          {ready < total * 0.95 && (
            <View style={[styles.progress, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {lang === 'en' ? `${ready} of ${total} pages ready — more are added with each update` : `இதுவரை ${total} பக்கங்களில் ${ready} தயார் — ஒவ்வொரு update-லும் மேலும் சேர்க்கப்படும்`}
              </ThemedText>
              <View style={[styles.bar, { backgroundColor: theme.border }]}>
                <View style={[styles.barFill, { backgroundColor: theme.primary, width: `${Math.round((100 * ready) / Math.max(total, 1))}%` }]} />
              </View>
            </View>
          )}

          {chapters.length > 0 && (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              {toc.title.toUpperCase()}
            </ThemedText>
          )}

          {chapters.map((c, ci) => {
            const isOpen = open === ci;
            const none = c.ready === 0;
            return (
              <Animated.View
                key={`${lang}-${ci}`}
                entering={enter(1 + Math.min(ci, 12))}
                style={[styles.chapter, { backgroundColor: theme.backgroundElement, borderColor: isOpen ? theme.primary : theme.border, opacity: none ? 0.55 : 1 }]}>
                <SpringPressable pressedScale={0.98} onPress={() => setOpen(isOpen ? null : ci)} style={styles.chapterHead}>
                  <JasmineBadge value={ci + 1} size={40} active={isOpen} />
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{c.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {(() => {
                        // The pages the chapter's topics start on, first to last.
                        const a = printedPage(c.items[0].page);
                        const b = printedPage(c.items[c.items.length - 1].page);
                        const pages = a === b ? t('page {a}', { a }) : t('pages {a}–{b}', { a, b });
                        return c.ready === c.items.length
                          ? `${t('{n} topics', { n: c.items.length })} · ${pages}`
                          : t('{r} of {n} topics ready', { r: c.ready, n: c.items.length });
                      })()}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: theme.primary }}>{isOpen ? '▴' : '▾'}</ThemedText>
                </SpringPressable>
                {isOpen &&
                  c.items.map((item, ii) => {
                    const ok = hasPage(item.page, lang);
                    return (
                      <SpringPressable
                        key={ii}
                        disabled={!ok}
                        pressedScale={0.98}
                        onPress={() => router.push(pageHref(item.page, lang, vol))}
                        style={[styles.item, { borderTopColor: theme.border, opacity: ok ? 1 : 0.45 }]}>
                        <JasmineFlower size={14} />
                        <ThemedText style={styles.flex}>{item.label}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
                          {ok ? printedPage(item.page) : t('soon')}
                        </ThemedText>
                      </SpringPressable>
                    );
                  })}
              </Animated.View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  back: { paddingVertical: Spacing.two },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.one, overflow: 'hidden' },
  heroFlower: { position: 'absolute', top: -20, right: -20 },
  heroArabic: { fontSize: 26, lineHeight: 44 },
  heroTitle: { fontFamily: Fonts?.serif, fontSize: 26, lineHeight: 34, fontWeight: 600 },
  heroBtn: { marginTop: Spacing.two, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  progress: { borderWidth: 1, borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: Spacing.two },
  chapter: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
