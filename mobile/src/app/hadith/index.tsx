import { Image } from "expo-image";
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContinueHadith } from "@/components/continue-reading";
import { enter, FloatingFlower, SpringPressable } from "@/components/motion";
import { SearchIcon } from "@/components/search-icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  Fonts,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { gridItemStyle, useLayout } from "@/hooks/use-layout";
import { useT } from "@/hooks/use-t";
import { useTheme } from "@/hooks/use-theme";
import { useAppState } from "@/lib/app-state";
import { BOOKS, type Book } from "@/lib/hadith-books";

// Book covers (scripts/hadith-covers.html, rendered with Chrome): Arabic title in Thuluth on each book's colour.
// Tamil covers (the same design with Tamil title and author), shown when the app is in Tamil.
const COVERS_TA: Record<string, number> = {
  muntakhab: require('@/assets/images/books/muntakhab-ta.webp'),
  sahaba1: require('@/assets/images/books/sahaba1-ta.webp'),
  sahaba2: require('@/assets/images/books/sahaba2-ta.webp'),
  sahaba3: require('@/assets/images/books/sahaba3-ta.webp'),
  sahaba4: require('@/assets/images/books/sahaba4-ta.webp'),
  bukhari: require('@/assets/images/books/bukhari-ta.webp'),
  muslim: require('@/assets/images/books/muslim-ta.webp'),
  abudawud: require('@/assets/images/books/abudawud-ta.webp'),
  tirmidhi: require('@/assets/images/books/tirmidhi-ta.webp'),
  nasai: require('@/assets/images/books/nasai-ta.webp'),
  ibnmajah: require('@/assets/images/books/ibnmajah-ta.webp'),
  malik: require('@/assets/images/books/malik-ta.webp'),
  nawawi: require('@/assets/images/books/nawawi-ta.webp'),
  qudsi: require('@/assets/images/books/qudsi-ta.webp'),
  dehlawi: require('@/assets/images/books/dehlawi-ta.webp'),
};

const COVERS: Record<string, number> = {
  muntakhab: require("@/assets/images/books/muntakhab.webp"),
  sahaba1: require("@/assets/images/books/sahaba1.webp"),
  sahaba2: require("@/assets/images/books/sahaba2.webp"),
  sahaba3: require("@/assets/images/books/sahaba3.webp"),
  sahaba4: require("@/assets/images/books/sahaba4.webp"),
  bukhari: require("@/assets/images/books/bukhari.webp"),
  muslim: require("@/assets/images/books/muslim.webp"),
  abudawud: require("@/assets/images/books/abudawud.webp"),
  tirmidhi: require("@/assets/images/books/tirmidhi.webp"),
  nasai: require("@/assets/images/books/nasai.webp"),
  ibnmajah: require("@/assets/images/books/ibnmajah.webp"),
  malik: require("@/assets/images/books/malik.webp"),
  nawawi: require("@/assets/images/books/nawawi.webp"),
  qudsi: require("@/assets/images/books/qudsi.webp"),
  dehlawi: require("@/assets/images/books/dehlawi.webp"),
};

// The Library: two shelves — the hadith books (Muntakhab Ahadith first), then the four volumes of Hayatus Sahaba.
type Vars = Record<string, string | number>;
type ShelfBook = { id: string; name: string; nv?: Vars; open: () => void; detail: string; dv?: Vars };
// What each volume of Hayatus Sahaba covers (its chapters in the Arabic original).
const SAHABA_VOLUMES = [
  "Da'wah, Bay'ah, Hardships, Hijrah",
  "Jihad, Unity, Spending for Allah",
  "Self-denial, Character, Taqwa",
  "Iman in the unseen, Salah, Masjids",
];
const SAHABA: ShelfBook[] = [
  // Hayatus Sahaba: the four volumes of the Arabic original, each its own book.
  ...[1, 2, 3, 4].map((v) => ({
    id: `sahaba${v}`,
    name: "Hayatus Sahaba · Vol {n}",
    nv: { n: v },
    open: () => router.push(`/hadith/sahaba?vol=${v}`),
    detail: SAHABA_VOLUMES[v - 1],
  })),
];
const HADITH: ShelfBook[] = [
  {
    id: "muntakhab",
    name: "Muntakhab Ahadith",
    open: () => router.push("/hadith/muntakhab"),
    detail: "Six qualities · offline",
  },
  ...BOOKS.map((b) => ({
    id: b.id,
    name: b.name,
    open: () => openBook(b),
    detail: b.sections.length > 1 ? "{n} hadith · {c} chapters" : "{n} hadith",
    dv: { n: b.total.toLocaleString(), c: b.sections.length },
  })),
];
const SHELVES = [
  {
    title: "Hadith",
    subtitle: "Muntakhab Ahadith and the hadith collections",
    books: HADITH,
  },
  {
    title: "The Sahabah",
    subtitle: "Hayatus Sahaba, in four volumes",
    books: SAHABA,
  },
];

function openBook(book: Book) {
  // The 40-hadith collections have a single chapter — go straight to it.
  if (book.sections.length === 1)
    router.push(`/hadith/${book.id}/${book.sections[0].id}`);
  else router.push(`/hadith/${book.id}`);
}

export default function HadithBooksScreen() {
  const theme = useTheme();
  const t = useT();
  const lang = useAppState().settings.language;
  const layout = useLayout();
  const { width } = useWindowDimensions();
  // A bookshelf: two books a row on phones, more on desktop.
  const columns = layout.wide ? layout.columns + 2 : 2;
  const cell = layout.wide
    ? gridItemStyle(columns, Spacing.four)
    : {
        flex: 1,
        maxWidth:
          (Math.min(width, MaxContentWidth) -
            2 * (Spacing.three + Spacing.one) -
            Spacing.three) /
          2,
      };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.maxWidth }]}>
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingTop: layout.topInset + Spacing.three },
            layout.wide && styles.listWide,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBlock}>
            <Animated.View entering={enter(0)} style={styles.header}>
              <ThemedText style={styles.title}>{t('Library')}</ThemedText>
              <FloatingFlower size={30} rotate={20} period={30} />
            </Animated.View>
            <Animated.View entering={enter(1)}>
              <SpringPressable
                pressedScale={0.98}
                onPress={() => router.push("/hadith/search")}
                style={[
                  styles.searchPill,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.border,
                  },
                ]}
              >
                <SearchIcon size={18} color={theme.textSecondary} />
                <ThemedText
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={styles.searchText}
                >
                  {t('Search the Library')}
                </ThemedText>
              </SpringPressable>
            </Animated.View>
            <ContinueHadith />
          </View>
          {SHELVES.map((shelf, si) => (
            <View key={shelf.title} style={styles.shelf}>
              <View style={styles.shelfHead}>
                <ThemedText style={styles.shelfTitle}>{t(shelf.title)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(shelf.subtitle)}
                </ThemedText>
              </View>
              {/* A bookshelf: rows of `columns` books; the last row keeps the same book width. */}
              {Array.from(
                { length: Math.ceil(shelf.books.length / columns) },
                (_, r) => (
                  <View
                    key={r}
                    style={[
                      styles.shelfRow,
                      layout.wide && styles.shelfRowWide,
                    ]}
                  >
                    {Array.from({ length: columns }, (_, c) => {
                      const b = shelf.books[r * columns + c];
                      if (!b) return <View key={c} style={cell} />;
                      return (
                        <Animated.View
                          key={b.id}
                          entering={enter(2 + si * 3 + r)}
                          style={cell}
                        >
                          <SpringPressable
                            pressedScale={0.96}
                            onPress={b.open}
                            style={[
                              styles.book,
                              layout.wide && styles.bookWide,
                            ]}
                          >
                            <View style={styles.coverShadow}>
                              <Image
                                source={(lang === 'ta' ? COVERS_TA : COVERS)[b.id]}
                                style={styles.cover}
                                contentFit="cover"
                                transition={150}
                                accessibilityLabel={t(b.name, b.nv)}
                              />
                            </View>
                            <View style={styles.bookText}>
                              <ThemedText
                                style={styles.bookTitle}
                                numberOfLines={2}
                              >
                                {t(b.name, b.nv)}
                              </ThemedText>
                              <ThemedText
                                type="small"
                                themeColor="textSecondary"
                                numberOfLines={1}
                              >
                                {t(b.detail, b.dv)}
                              </ThemedText>
                            </View>
                          </SpringPressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                ),
              )}
            </View>
          ))}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.source}
          >
            {t('{n} books in the Library', { n: HADITH.length + SAHABA.length })}
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: "row", justifyContent: "center" },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  list: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listWide: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.five },
  shelfRow: {
    flexDirection: "row",
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  shelfRowWide: { gap: Spacing.four },
  book: { gap: Spacing.two },
  bookWide: { cursor: "pointer" },
  coverShadow: {
    borderRadius: 14,
    boxShadow: "0 8px 18px rgba(0, 0, 0, 0.22)",
  },
  cover: {
    width: "100%",
    aspectRatio: 600 / 840,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  bookText: { gap: 2, paddingHorizontal: Spacing.one },
  bookTitle: { fontWeight: 700, fontSize: 15, lineHeight: 20 },
  headerBlock: { gap: Spacing.three, paddingBottom: Spacing.four },
  shelf: { paddingBottom: Spacing.three },
  shelfHead: {
    gap: 2,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  shelfTitle: {
    fontFamily: Fonts?.serif,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 600,
  },
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: 600,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  searchText: { flex: 1, fontSize: 16 },
  source: { textAlign: "center", paddingTop: Spacing.three },
});
