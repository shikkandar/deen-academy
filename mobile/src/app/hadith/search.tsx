import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SpringPressable } from '@/components/motion';
import { SearchIcon } from '@/components/search-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { searchAll, warmUp, whereLabel, type Hit, type Results } from '@/lib/hadith-search';

type Filter = 'all' | 'muntakhab' | 'books';

const GROUPS = [
  { key: 'muntakhab', title: 'MUNTAKHAB AHADITH', filter: 'muntakhab' },
  { key: 'hadith', title: 'SAVED HADITH BOOK CHAPTERS', filter: 'books' },
  { key: 'chapters', title: 'CHAPTER TITLES', filter: 'books' },
] as const;

function hrefFor(hit: Hit, q: string): Href {
  const w = hit.where;
  const query = encodeURIComponent(q);
  if (w.kind === 'muntakhab') return `/hadith/muntakhab/${w.page}?lang=${w.lang}&b=${w.block}&q=${query}` as Href;
  if (w.kind === 'chapter') return `/hadith/${w.book}/${w.section}` as Href;
  return `/hadith/${w.book}/${w.section}?at=${w.index}` as Href;
}

type Row = { type: 'title'; key: string; title: string; total: number } | { type: 'hit'; key: string; hit: Hit };

/** One search over Muntakhab Ahadith and the hadith books. */
export default function HadithSearchScreen() {
  const theme = useTheme();
  const t = useT();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);

  useEffect(() => warmUp(), []);

  const onChange = (text: string) => {
    setQ(text);
    const id = ++runId.current;
    setBusy(true);
    // wait for a pause in typing, then search
    setTimeout(() => {
      if (id !== runId.current) return;
      searchAll(text).then((r) => {
        if (id !== runId.current) return;
        setResults(r);
        setBusy(false);
      });
    }, 250);
  };

  const rows: Row[] = [];
  if (results) {
    for (const g of GROUPS) {
      if (filter !== 'all' && filter !== g.filter) continue;
      const r = results[g.key];
      if (!r.total) continue;
      rows.push({ type: 'title', key: g.key, title: g.title, total: r.total });
      r.hits.forEach((hit, i) => rows.push({ type: 'hit', key: `${g.key}-${i}`, hit }));
    }
  }
  const total = results
    ? GROUPS.reduce((n, g) => n + (filter === 'all' || filter === g.filter ? results[g.key].total : 0), 0)
    : 0;

  const back = () => {
    if (router.canDismiss()) router.dismissTo('/hadith');
    else router.replace('/hadith');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.top}>
          <View style={styles.searchRow}>
            <SpringPressable onPress={back} style={styles.back}>
              <ThemedText style={[styles.bold, { color: theme.primary }]}>‹</ThemedText>
            </SpringPressable>
            <View style={[styles.field, { borderColor: theme.primary, backgroundColor: theme.backgroundElement }]}>
              <SearchIcon size={18} color={theme.textSecondary} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={onChange}
                placeholder={t('Search hadith')}
                placeholderTextColor={theme.textSecondary}
                returnKeyType="search"
                style={[styles.search, { color: theme.text }]}
              />
              {!!q && (
                <SpringPressable onPress={() => onChange('')} style={styles.clear}>
                  <ThemedText themeColor="textSecondary">✕</ThemedText>
                </SpringPressable>
              )}
            </View>
          </View>
          <View style={styles.filters}>
            {(
              [
                ['all', 'All'],
                ['muntakhab', 'Muntakhab'],
                ['books', 'Hadith books'],
              ] as const
            ).map(([id, label]) => (
              <SpringPressable
                key={id}
                pressedScale={0.95}
                onPress={() => setFilter(id)}
                style={[styles.chip, { backgroundColor: filter === id ? theme.primary : theme.primarySoft }]}
              >
                <ThemedText type="small" style={[styles.bold, { color: filter === id ? theme.onPrimary : theme.primary }]}>
                  {t(label)}
                </ThemedText>
              </SpringPressable>
            ))}
            <View style={styles.flex} />
            {busy ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              results && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('{n} found', { n: total })}
                </ThemedText>
              )
            )}
          </View>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(r) => r.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {!q.trim()
                ? t('Search every page of Muntakhab Ahadith (Tamil and English), the chapter titles of every hadith book, the hadith books with Tamil in the app, and the hadith chapters you have opened. Arabic works with or without vowel marks.')
                : busy
                  ? ''
                  : t('Nothing found. Try fewer or different words.')}
            </ThemedText>
          }
          renderItem={({ item }) =>
            item.type === 'title' ? (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
                {t(item.title)} · {item.total}
                {item.total > 60 ? t(' (first {n})', { n: 60 }) : ''}
              </ThemedText>
            ) : (
              <Animated.View entering={FadeIn.duration(200)}>
                <SpringPressable
                  pressedScale={0.98}
                  onPress={() => router.push(hrefFor(item.hit, q))}
                  style={[styles.hit, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
                >
                  <ThemedText type="small" style={[styles.bold, { color: theme.primary }]} numberOfLines={1}>
                    {whereLabel(item.hit.where, t)}
                  </ThemedText>
                  <ThemedText style={styles.snippet}>
                    {item.hit.cutStart ? '… ' : ''}
                    {item.hit.parts.map((p, i) =>
                      p.mark ? (
                        <ThemedText key={i} style={[styles.mark, { backgroundColor: theme.petalSoft, color: theme.primary }]}>
                          {p.text}
                        </ThemedText>
                      ) : (
                        p.text
                      ),
                    )}
                    {item.hit.cutEnd ? ' …' : ''}
                  </ThemedText>
                </SpringPressable>
              </Animated.View>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  top: { paddingHorizontal: Spacing.three, paddingTop: TopTabInset + Spacing.two, gap: Spacing.two, paddingBottom: Spacing.two },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  back: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.two },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingLeft: Spacing.three,
    height: 46,
  },
  search: { flex: 1, fontSize: 16, height: '100%' },
  clear: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  filters: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chip: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.two },
  groupTitle: { letterSpacing: 1.2, fontSize: 11, paddingTop: Spacing.three, paddingHorizontal: Spacing.one },
  hit: { borderWidth: 1, borderRadius: 18, padding: Spacing.three, gap: Spacing.one },
  snippet: { fontSize: 15, lineHeight: 24 },
  mark: { fontWeight: 700, borderRadius: 4 },
  empty: { textAlign: 'center', paddingTop: Spacing.five, paddingHorizontal: Spacing.four, lineHeight: 22 },
});
