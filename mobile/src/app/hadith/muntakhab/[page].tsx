import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge } from '@/components/jasmine-flower';
import { SpringPressable } from '@/components/motion';
import { MuntakhabLangSwitch } from '@/components/muntakhab-lang';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { markParts, queryTerms } from '@/lib/hadith-search';
import { FIRST_PAGE, getPage, LAST_PAGE, loadLang, saveLang, saveProgress, type Block, type MLang } from '@/lib/muntakhab';

/** `text` with the searched words marked. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const theme = useTheme();
  if (!terms.length) return text;
  return markParts(text, terms).map((p, i) =>
    p.mark ? (
      <ThemedText key={i} style={[styles.bold, { backgroundColor: theme.petalSoft, color: theme.primary }]}>
        {p.text}
      </ThemedText>
    ) : (
      p.text
    ),
  );
}

function BlockView({ block, terms }: { block: Block; terms: string[] }) {
  const theme = useTheme();
  const t = useT();
  const M = (text: string) => <Marked text={text} terms={terms} />;
  switch (block.type) {
    case 'heading':
      if (block.level === 'chapter')
        return <ThemedText style={[styles.chapter, { color: theme.primary }]}>{M(block.text)}</ThemedText>;
      if (block.level === 'topic') return <ThemedText style={styles.topic}>{M(block.text)}</ThemedText>;
      return (
        <ThemedText type="smallBold" style={[styles.section, { color: theme.primary }]}>
          {M(block.text)}
        </ThemedText>
      );
    case 'paragraph':
      return <ThemedText style={styles.body}>{M(block.text)}</ThemedText>;
    case 'explanation':
      return (
        <View style={[styles.explanation, { borderLeftColor: theme.gold }]}>
          <ThemedText themeColor="textSecondary" style={styles.explanationText}>
            {M(block.text)}
          </ThemedText>
        </View>
      );
    case 'quran':
      return (
        <View style={[styles.card, { backgroundColor: theme.primarySoft, borderColor: 'transparent' }]}>
          {block.verse_number != null && !block.continued && (
            <ThemedText type="smallBold" style={[styles.label, { color: theme.primary }]}>
              {t('QURAN · {n}', { n: block.verse_number })}
            </ThemedText>
          )}
          {!!block.arabic_text && <ThemedText style={styles.arabic}>{M(block.arabic_text)}</ThemedText>}
          {!!block.surah_reference && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.arabicRef}>
              {block.surah_reference}
            </ThemedText>
          )}
          {!!block.tamil_translation && <ThemedText style={styles.body}>{M(block.tamil_translation)}</ThemedText>}
          {!!block.surah_reference_tamil && (
            <ThemedText type="small" themeColor="textSecondary">
              {block.surah_reference_tamil}
            </ThemedText>
          )}
        </View>
      );
    case 'hadith':
      return (
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {!block.continued && (
            <View style={styles.hadithTop}>
              <JasmineBadge value={block.hadith_number} size={40} />
              {!!block.narrator && (
                <ThemedText type="smallBold" style={[styles.flex, { color: theme.primary }]}>
                  {block.narrator}
                </ThemedText>
              )}
            </View>
          )}
          {!!block.arabic_text && <ThemedText style={styles.arabic}>{M(block.arabic_text)}</ThemedText>}
          {!!block.source_reference_arabic && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.arabicRef}>
              {block.source_reference_arabic}
            </ThemedText>
          )}
          {!!block.arabic_text && !!block.tamil_translation && <View style={[styles.divider, { backgroundColor: theme.gold }]} />}
          {!!block.tamil_translation && <ThemedText style={styles.body}>{M(block.tamil_translation)}</ThemedText>}
          {!!block.source_reference_tamil && (
            <ThemedText type="small" themeColor="textSecondary">
              {block.source_reference_tamil}
            </ThemedText>
          )}
        </View>
      );
  }
}

/** One printed page of Muntakhab Ahadith, in the app's theme. */
export default function MuntakhabPage() {
  const theme = useTheme();
  const t = useT();
  const layout = useLayout();
  const appLang = useAppState().settings.language;
  // From search: `lang` to read in, `b` the block to scroll to, `q` the words to mark.
  const { page: param, lang: langParam, b, q } = useLocalSearchParams<{ page: string; lang?: MLang; b?: string; q?: string }>();
  const terms = q ? queryTerms(q) : [];
  const blockY = useRef<Record<number, number>>({});
  const n = Math.min(Math.max(Number(param) || FIRST_PAGE, FIRST_PAGE), LAST_PAGE);
  const [lang, setLang] = useState<MLang>(langParam === 'en' || langParam === 'ta' ? langParam : appLang);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Opened from search: read in the language of the hit (set above); otherwise the one last chosen.
  useEffect(() => {
    if (langParam === 'ta' || langParam === 'en') return;
    loadLang(appLang).then(setLang);
  }, [langParam, appLang]);
  // Scroll to the searched block once it has been laid out.
  const scrollToHit = () => {
    const y = blockY.current[Number(b)];
    if (b != null && y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  };
  useEffect(() => {
    saveProgress(n);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [n]);

  const changeLang = (l: MLang) => {
    setLang(l);
    saveLang(l);
  };
  // The page (async: fetched on web). Keyed by page and language so a stale load never shows.
  const [loaded, setLoaded] = useState<{ key: string; page: Awaited<ReturnType<typeof getPage>> } | null>(null);
  const pageKey = `${n}-${lang}`;
  useEffect(() => {
    let live = true;
    getPage(n, lang).then((p) => live && setLoaded({ key: pageKey, page: p }));
    return () => {
      live = false;
    };
  }, [n, lang, pageKey]);
  const page = loaded?.key === pageKey ? loaded.page : null;
  const goTo = (p: number) => router.replace(`/hadith/muntakhab/${p}` as Href);
  const contents = () => {
    if (router.canDismiss()) router.dismissTo('/hadith/muntakhab');
    else router.replace('/hadith/muntakhab');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.readingWidth }]}>
        <View style={[styles.topBar, { paddingTop: layout.topInset + Spacing.two, borderBottomColor: theme.border }]}>
          <SpringPressable onPress={contents} style={styles.back}>
            <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
              {t('‹ Contents')}
            </ThemedText>
          </SpringPressable>
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.center}>
              {page?.header.running_head ?? 'Muntakhab Ahadith'}
            </ThemedText>
          </View>
          <MuntakhabLangSwitch value={lang} onChange={changeLang} />
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View key={`${n}-${lang}`} entering={FadeIn.duration(300)} style={styles.blocks}>
            {page ? (
              page.blocks.map((block, i) => (
                <View
                  key={i}
                  onLayout={(e) => {
                    blockY.current[i] = e.nativeEvent.layout.y;
                    if (i === Number(b)) setTimeout(scrollToHit, 50);
                  }}>
                  <BlockView block={block} terms={terms} />
                </View>
              ))
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.center}>
                {t('This page is not available.')}
              </ThemedText>
            )}
          </Animated.View>

          <View style={styles.nav}>
            <SpringPressable
              disabled={n <= FIRST_PAGE}
              pressedScale={0.95}
              onPress={() => goTo(n - 1)}
              style={[styles.navBtn, { borderColor: theme.border, opacity: n <= FIRST_PAGE ? 0.4 : 1 }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('‹ Page {n}', { n: n - 1 })}
              </ThemedText>
            </SpringPressable>
            <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
              {n} / {LAST_PAGE}
            </ThemedText>
            <SpringPressable
              disabled={n >= LAST_PAGE}
              pressedScale={0.95}
              onPress={() => goTo(n + 1)}
              style={[styles.navBtn, { backgroundColor: theme.primarySoft, borderColor: 'transparent', opacity: n >= LAST_PAGE ? 0.4 : 1 }]}>
              <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                {t('Page {n} ›', { n: n + 1 })}
              </ThemedText>
            </SpringPressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
  chapter: { fontFamily: Fonts?.serif, fontSize: 24, lineHeight: 34, fontWeight: 600, textAlign: 'center', paddingVertical: Spacing.two },
  topic: { fontFamily: Fonts?.serif, fontSize: 19, lineHeight: 28, fontWeight: 600 },
  section: { letterSpacing: 0.5 },
  body: { fontSize: 16, lineHeight: 27 },
  explanation: { borderLeftWidth: 2, paddingLeft: Spacing.three },
  explanationText: { fontSize: 15, lineHeight: 25, fontStyle: 'italic' },
  card: { borderWidth: 1, borderRadius: 22, padding: Spacing.three + Spacing.one, gap: Spacing.two + 2 },
  label: { letterSpacing: 1.2, fontSize: 11 },
  hadithTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  arabic: { fontSize: 22, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl' },
  arabicRef: { textAlign: 'right', writingDirection: 'rtl' },
  divider: { height: 1.5, width: 36, borderRadius: 1, opacity: 0.7, alignSelf: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  navBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
