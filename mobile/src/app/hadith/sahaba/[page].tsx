import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpringPressable } from '@/components/motion';
import { SahabaLangSwitch } from '@/components/sahaba-lang';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { markParts, queryTerms } from '@/lib/hadith-search';
import { useT } from '@/hooks/use-t';
import { getPage, hasPage, loadLang, neighbours, pageLabel, samePlaceIn, saveLang, saveProgress, shownLang, volumeFor, volumeOf, type Block, type SLang } from '@/lib/sahaba';

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** `[^12]` footnote markers as superscript numbers. */
const withNotes = (text: string) => text.replace(/\[\^(\d+)\]/g, (_, n: string) => [...n].map((d) => SUP[Number(d)]).join(''));

/** `text` with the searched words marked. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const theme = useTheme();
  const t = withNotes(text);
  if (!terms.length) return t;
  return markParts(t, terms).map((p, i) =>
    p.mark ? (
      <ThemedText key={i} style={[styles.bold, { backgroundColor: theme.petalSoft, color: theme.primary }]}>
        {p.text}
      </ThemedText>
    ) : (
      p.text
    ),
  );
}

function BlockView({ block, terms, rtl }: { block: Block; terms: string[]; rtl: boolean }) {
  const theme = useTheme();
  // On Arabic pages the text itself is Arabic: right to left, in the Arabic size.
  const M = (text: string) => (rtl ? <ThemedText style={styles.arabicBody}>{text}</ThemedText> : <Marked text={text} terms={terms} />);
  switch (block.type) {
    case 'heading':
      return (
        <View style={styles.headingWrap}>
          {!!block.arabic_text && <ThemedText style={[styles.arabic, styles.centerArabic]}>{block.arabic_text}</ThemedText>}
          {block.level === 'chapter' ? (
            <ThemedText style={[styles.chapter, { color: theme.primary }]}>{M(block.text)}</ThemedText>
          ) : block.level === 'topic' ? (
            <ThemedText style={styles.topic}>{M(block.text)}</ThemedText>
          ) : (
            <ThemedText style={[styles.section, { color: theme.primary }]}>{M(block.text)}</ThemedText>
          )}
        </View>
      );
    case 'paragraph':
      return (
        <View style={styles.headingWrap}>
          {!!block.arabic_text && <ThemedText style={styles.arabic}>{block.arabic_text}</ThemedText>}
          {!!block.text && <ThemedText style={styles.body}>{M(block.text)}</ThemedText>}
        </View>
      );
    case 'narration':
      return (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {!block.continued && !!block.narrator && (
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {block.narrator}
            </ThemedText>
          )}
          {!!block.arabic_text && <ThemedText style={styles.arabic}>{block.arabic_text}</ThemedText>}
          {!!block.arabic_text && !!block.text && <View style={[styles.divider, { backgroundColor: theme.gold }]} />}
          {!!block.text && <ThemedText style={styles.body}>{M(block.text)}</ThemedText>}
          {!!block.source && (
            <ThemedText type="small" themeColor="textSecondary">
              {withNotes(block.source)}
            </ThemedText>
          )}
        </View>
      );
    case 'quran':
      return (
        <View style={[styles.card, { backgroundColor: theme.primarySoft, borderColor: 'transparent' }]}>
          {!!block.arabic_text && <ThemedText style={styles.arabic}>{block.arabic_text}</ThemedText>}
          {!!block.text && <ThemedText style={styles.body}>{M(block.text)}</ThemedText>}
          {!!block.reference && (
            <ThemedText type="small" themeColor="textSecondary">
              {withNotes(block.reference)}
            </ThemedText>
          )}
        </View>
      );
    case 'poetry':
      return (
        <View style={[styles.poetry, { borderLeftColor: theme.gold }]}>
          {!!block.arabic_text && <ThemedText style={[styles.arabic, styles.centerArabic]}>{block.arabic_text}</ThemedText>}
          {!!block.text && (
            <ThemedText themeColor="textSecondary" style={styles.poetryText}>
              {M(block.text)}
            </ThemedText>
          )}
        </View>
      );
    case 'footnote':
      return (
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          {block.number != null ? `${block.number}. ` : ''}
          {M(block.text)}
        </ThemedText>
      );
  }
}

/** One printed page of Hayatus Sahaba, in the app's theme. */
export default function SahabaPage() {
  const theme = useTheme();
  const t = useT();
  const layout = useLayout();
  // `lang` the edition, from search `b` the block to scroll to and `q` the words to mark.
  const { page: param, lang: langParam, b, q, vol: volParam } = useLocalSearchParams<{ page: string; lang?: SLang; b?: string; q?: string; vol?: string }>();
  const terms = q ? queryTerms(q) : [];
  const blockY = useRef<Record<number, number>>({});
  const n = Number(param) || 0;
  // The edition comes from the link; without one, the last edition read.
  const appLang = useAppState().settings.language;
  const [savedLang, setSavedLang] = useState<SLang | null>(null);
  // Arabic and the printed Tamil are no longer offered: a link to one of them opens in Tamil.
  const lang: SLang | null = shownLang(langParam) ?? savedLang;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    loadLang(appLang).then(setSavedLang);
  }, [appLang]);
  const scrollToHit = () => {
    const y = blockY.current[Number(b)];
    if (b != null && y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  };
  useEffect(() => {
    if (lang && hasPage(n, lang)) saveProgress(n, lang, lang === 'ta' || lang === 'ar' ? volumeOf(n) : Number(volParam) || 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [n, lang, volParam]);

  // The book (volume) this page is read in: Arabic and Tamil pages carry their volume; English and the printed Tamil keep the one they were opened from.
  const book = lang === 'ta' || lang === 'ar' ? volumeOf(n) : Number(volParam) || 1;
  const contents = () => {
    const href = `/hadith/sahaba?vol=${book}` as Href;
    if (router.canDismiss()) router.dismissTo(href);
    else router.replace(href);
  };
  // Switching edition stays on the reading page: the same chapter, about as far into it (English has its own pages).
  const changeLang = (l: SLang) => {
    saveLang(l);
    const to = lang ? samePlaceIn(n, lang, l) : null;
    if (to == null) return contents(); // that edition has no page here yet
    const toBook = l === 'ta' ? volumeOf(to) : book; // Tamil pages carry their volume; English keeps the book it came from
    // In place, with no screen transition: only the page shown changes.
    router.setParams({ page: String(to), lang: l, vol: String(toBook) });
  };

  const [loaded, setLoaded] = useState<{ key: string; page: Awaited<ReturnType<typeof getPage>> } | null>(null);
  const pageKey = `${n}-${lang}`;
  useEffect(() => {
    if (!lang) return;
    let live = true;
    getPage(n, lang).then((p) => live && setLoaded({ key: pageKey, page: p }));
    return () => {
      live = false;
    };
  }, [n, lang, pageKey]);
  const loading = loaded?.key !== pageKey;
  const page = loading ? null : loaded.page;
  const { prev, next } = lang ? neighbours(n, lang, volumeFor(lang, book)) : { prev: null, next: null };
  const goTo = (p: number) => router.replace(`/hadith/sahaba/${p}?lang=${lang}&vol=${book}` as Href);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.readingWidth }]}>
        <View style={[styles.topBar, { paddingTop: layout.topInset + Spacing.two, borderBottomColor: theme.border }]}>
          <SpringPressable onPress={contents} style={styles.back}>
            <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
              ‹ {t('Contents')}
            </ThemedText>
          </SpringPressable>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.center}>
              {page?.header.running_head || t('Hayatus Sahaba')}
            </ThemedText>
          </View>
          {lang && <SahabaLangSwitch value={lang} onChange={changeLang} />}
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View key={pageKey} style={styles.blocks}>
            {page ? (
              page.blocks.map((block, i) => (
                <View
                  key={i}
                  onLayout={(e) => {
                    blockY.current[i] = e.nativeEvent.layout.y;
                    if (i === Number(b)) setTimeout(scrollToHit, 50);
                  }}>
                  <BlockView block={block} terms={terms} rtl={lang === 'ar'} />
                </View>
              ))
            ) : loading ? (
              <ActivityIndicator color={theme.primary} style={styles.loading} />
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {t('This page is not in the app yet — it is coming in an update.')}
              </ThemedText>
            )}
          </View>

          <View style={styles.nav}>
            <SpringPressable
              disabled={prev == null}
              pressedScale={0.95}
              onPress={() => prev != null && goTo(prev)}
              style={[styles.navBtn, { borderColor: theme.border, opacity: prev == null ? 0.4 : 1 }]}>
              <ThemedText type="small" themeColor="textSecondary">
                ‹ {t('Previous')}
              </ThemedText>
            </SpringPressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
              {lang ? pageLabel(n, lang) : ''}
            </ThemedText>
            <SpringPressable
              disabled={next == null}
              pressedScale={0.95}
              onPress={() => next != null && goTo(next)}
              style={[styles.navBtn, { backgroundColor: theme.primarySoft, borderColor: 'transparent', opacity: next == null ? 0.4 : 1 }]}>
              <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                {t('Next')} ›
              </ThemedText>
            </SpringPressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 48 },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { paddingVertical: Spacing.one },
  scroll: { paddingHorizontal: Spacing.three + Spacing.one, paddingTop: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.four },
  blocks: { gap: Spacing.three },
  headingWrap: { gap: Spacing.one },
  chapter: { fontFamily: Fonts?.serif, fontSize: 24, lineHeight: 34, fontWeight: 600, textAlign: 'center', paddingVertical: Spacing.two },
  topic: { fontFamily: Fonts?.serif, fontSize: 19, lineHeight: 28, fontWeight: 600, textAlign: 'center' },
  section: { fontSize: 16, lineHeight: 24, fontWeight: 700 },
  body: { fontSize: 16, lineHeight: 27 },
  card: { borderWidth: 1, borderRadius: 22, padding: Spacing.three + Spacing.one, gap: Spacing.two + 2 },
  arabic: { fontSize: 22, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl' },
  arabicBody: { fontSize: 20, lineHeight: 38, textAlign: 'right', writingDirection: 'rtl' },
  centerArabic: { textAlign: 'center' },
  divider: { height: 1.5, width: 36, borderRadius: 1, opacity: 0.7, alignSelf: 'center' },
  poetry: { borderLeftWidth: 2, paddingLeft: Spacing.three, gap: Spacing.one },
  poetryText: { fontSize: 15, lineHeight: 25, fontStyle: 'italic' },
  footnote: { lineHeight: 20 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  navBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
