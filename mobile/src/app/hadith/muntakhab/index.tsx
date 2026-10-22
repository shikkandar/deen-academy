import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge, JasmineFlower } from '@/components/jasmine-flower';
import { enter, FloatingFlower, SpringPressable } from '@/components/motion';
import { MuntakhabLangSwitch } from '@/components/muntakhab-lang';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { chapterOf, loadLang, saveLang, TOC, useLastPage, type MLang } from '@/lib/muntakhab';
import { timeAgo } from '@/lib/reading-progress';

const pageHref = (n: number) => `/hadith/muntakhab/${n}` as Href;

/** Muntakhab Ahadith: contents, by chapter, with "continue reading". */
export default function MuntakhabContents() {
  const theme = useTheme();
  const t = useT();
  const layout = useLayout();
  // Until she picks one here, Muntakhab follows the app language.
  const appLang = useAppState().settings.language;
  const [lang, setLang] = useState<MLang>(appLang);
  const [open, setOpen] = useState<number | null>(0);
  const last = useLastPage();
  useEffect(() => {
    loadLang(appLang).then(setLang);
  }, [appLang]);
  const changeLang = (l: MLang) => {
    setLang(l);
    saveLang(l);
  };
  const toc = TOC[lang];
  const lastChapter = last ? chapterOf(last.page, lang) : null;

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
                {t('‹ All books')}
              </ThemedText>
            </SpringPressable>
            <MuntakhabLangSwitch value={lang} onChange={changeLang} />
          </View>

          <Animated.View entering={enter(0)} style={[styles.hero, { backgroundColor: theme.hero }]}>
            <FloatingFlower size={90} rotate={18} period={50} style={[styles.heroFlower, { opacity: 0.14 }]} />
            <ThemedText style={[styles.heroArabic, { color: theme.onHero }]}>مُنْتَخَبُ الأَحَادِيث</ThemedText>
            <ThemedText style={[styles.heroTitle, { color: theme.onHero }]}>Muntakhab Ahadith</ThemedText>
            <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
              {lang === 'ta' ? t('Tamil translation') : t('English translation')}
              {t(' · {n} chapters', { n: toc.chapters.length })}
            </ThemedText>
            <SpringPressable
              onPress={() => router.push(pageHref(last?.page ?? toc.chapters[0].items[0].page))}
              style={[styles.heroBtn, { backgroundColor: theme.onHero }]}>
              <ThemedText type="small" style={[styles.bold, { color: theme.hero }]}>
                {last ? t('Continue · page {n}', { n: last.page }) : t('Start reading')}
              </ThemedText>
            </SpringPressable>
            {last && lastChapter && (
              <ThemedText type="small" style={{ color: theme.onHeroMuted }} numberOfLines={1}>
                {lastChapter.item} · {timeAgo(last.at, t)}
              </ThemedText>
            )}
          </Animated.View>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {toc.title.toUpperCase()}
          </ThemedText>

          {toc.chapters.map((c, ci) => {
            const isOpen = open === ci;
            return (
              <Animated.View
                key={`${lang}-${ci}`}
                entering={enter(1 + ci)}
                style={[styles.chapter, { backgroundColor: theme.backgroundElement, borderColor: isOpen ? theme.primary : theme.border }]}>
                <SpringPressable pressedScale={0.98} onPress={() => setOpen(isOpen ? null : ci)} style={styles.chapterHead}>
                  <JasmineBadge value={ci + 1} size={40} active={isOpen} />
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{c.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('{n} topics · from page {page}', { n: c.items.length, page: c.items[0]?.page ?? '' })}
                    </ThemedText>
                  </View>
                  <ThemedText style={{ color: theme.primary }}>{isOpen ? '▴' : '▾'}</ThemedText>
                </SpringPressable>
                {isOpen &&
                  c.items.map((item, ii) => (
                    <SpringPressable
                      key={ii}
                      pressedScale={0.98}
                      onPress={() => router.push(pageHref(item.page))}
                      style={[styles.item, { borderTopColor: theme.border }]}>
                      <JasmineFlower size={14} />
                      <ThemedText style={styles.flex}>{item.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
                        {item.page}
                      </ThemedText>
                    </SpringPressable>
                  ))}
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
  tabular: { fontVariant: ['tabular-nums'] },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { paddingVertical: Spacing.two },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.one, overflow: 'hidden' },
  heroFlower: { position: 'absolute', top: -20, right: -20 },
  heroArabic: { fontSize: 26, lineHeight: 44 },
  heroTitle: { fontFamily: Fonts?.serif, fontSize: 26, lineHeight: 32, fontWeight: 600 },
  heroBtn: { marginTop: Spacing.two, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
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
