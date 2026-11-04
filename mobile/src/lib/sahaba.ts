import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import tocAr from '@/assets/sahaba/toc-ar.json';
import tocEn from '@/assets/sahaba/toc-en.json';
import tocTa from '@/assets/sahaba/toc-ta.json';
import tocTp from '@/assets/sahaba/toc-tp.json';

import { PAGE_IDS, PAGES } from './sahaba-pages';

// Hayatus Sahaba (Maulana Muhammad Yusuf Kandhlawi), page by page like Muntakhab Ahadith (scripts/sahaba/RULES.md):
//   ar — the original Arabic (Bashar Awwad's edition, 4 volumes, from al-Maktaba al-Shamila);
//   ta — our Tamil of those same Arabic pages (AI, for the Ulama committee to check), so Arabic ⇄ Tamil stays on the page;
//   en — The Lives of the Sahabah (English, 3 volumes), read from the scans, with its own pages;
//   tp — the printed Tamil edition (Darul Marashid, Chennai: பாகம் 1, அத்தியாயம் 1–2), with its own pages.
// Page ids are volume * 1000 + printed page. Pages are added as they are done; the rest show as "coming".

export type SLang = 'ta' | 'ar' | 'en' | 'tp';

export type Block =
  | { type: 'heading'; level: 'chapter' | 'topic' | 'section'; text: string; arabic_text?: string }
  | { type: 'paragraph'; text: string; arabic_text?: string; continued?: boolean }
  | { type: 'narration'; narrator?: string; text: string; arabic_text?: string; source?: string; number?: number; continued?: boolean }
  | { type: 'quran'; arabic_text?: string; reference?: string; text?: string; continued?: boolean }
  | { type: 'poetry'; arabic_text?: string; text?: string; continued?: boolean }
  | { type: 'footnote'; number?: number; text: string; continued?: boolean };

export type Page = {
  header: { book_title: string; volume: number; page_number: number; running_head?: string };
  blocks: Block[];
};

export type TocItem = { label: string; page: number };
export type Toc = { title: string; total: number; chapters: { title: string; items: TocItem[] }[] };

export const TOC: Record<SLang, Toc> = { ta: tocTa as Toc, ar: tocAr as Toc, en: tocEn as Toc, tp: tocTp as Toc };

export const LANG_LABEL: Record<SLang, string> = { ta: 'தமிழ்', ar: 'عربي', en: 'English', tp: 'அச்சு' };
export const LANG_DETAIL: Record<SLang, string> = {
  en: 'English translation',
  ta: 'அரபி மூலத்திலிருந்து தமிழ் (AI) · உலமா சபை சரிபார்க்கவில்லை',
  ar: 'الأصل العربي · تحقيق د. بشار عواد معروف',
  tp: 'அச்சுப் பதிப்பு · தாருல் மராஷித், சென்னை',
};

/** The pages there are in this language right now (ar and ta share page ids). */
/** Arabic and our Tamil are the same pages; English and the printed Tamil each have their own. */
export const samePages = (a: SLang, b: SLang) => a === b || (a !== 'en' && a !== 'tp' && b !== 'en' && b !== 'tp');
export const pageIds = (lang: SLang) => PAGE_IDS[lang];
export const hasPage = (id: number, lang: SLang) => !!PAGES[lang][id];

export const volumeOf = (id: number) => Math.floor(id / 1000);
export const printedPage = (id: number) => id % 1000;

/** One page, fetched from /data (in the apps: downloaded once, then kept on the phone). Null offline if never opened. */
export async function getPage(id: number, lang: SLang): Promise<Page | null> {
  const load = PAGES[lang][id];
  if (!load) return null;
  const page = (await load()) as Page | null;
  return page?.blocks ? page : null;
}

/** The page before / after `id` that is ready in this language. */
/** The Arabic original (and our Tamil of it) is four volumes; each is its own book on the shelf. */
export const VOLUMES = [1, 2, 3, 4] as const;
const perVolume = (lang: SLang) => lang === 'ta' || lang === 'ar';
/** The volume a book shows in this language (English and the printed Tamil are always the whole edition). */
export const volumeFor = (lang: SLang, vol: number | null) => (vol && perVolume(lang) ? vol : null);
/** The pages there are in this language, within the volume when there is one. */
export const pagesIn = (lang: SLang, vol: number | null) => {
  const v = volumeFor(lang, vol);
  return v ? PAGE_IDS[lang].filter((id) => volumeOf(id) === v) : PAGE_IDS[lang];
};
/** The contents of one volume: its topics, and the chapters that have any. */
export function tocFor(lang: SLang, vol: number | null): Toc {
  const v = volumeFor(lang, vol);
  const toc = TOC[lang];
  if (!v) return toc;
  const chapters = toc.chapters
    .map((c) => ({ ...c, items: c.items.filter((i) => volumeOf(i.page) === v) }))
    .filter((c) => c.items.length > 0);
  return { ...toc, total: pagesIn(lang, v).length, chapters };
}

export function neighbours(id: number, lang: SLang, vol: number | null = null) {
  const ids = pagesIn(lang, vol);
  let prev: number | null = null;
  let next: number | null = null;
  for (const x of ids) {
    if (x < id) prev = x;
    else if (x > id) {
      next = x;
      break;
    }
  }
  return { prev, next };
}

/** The language shown for a page link's `lang`: Arabic and the printed Tamil, no longer offered, open in Tamil. */
export const shownLang = (lang: string | undefined | null): SLang | null =>
  lang === 'en' ? 'en' : lang === 'ta' || lang === 'ar' || lang === 'tp' ? 'ta' : null;

// Where each chapter (bab) starts: in the Arabic original, whose pages our Tamil shares ("الباب الأول" …), and in the
// English, which has its own pages ("Vol 1 · Chapter 1: …"). Both follow the original's order of chapters.
const AR_ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
function arChapterNo(title: string) {
  const m = title.match(/^الباب (ال[^\s]+)(?: (عشر))?/);
  if (!m) return null;
  if (m[1] === 'الحادي' && m[2]) return 11;
  const i = AR_ORDINALS.indexOf(m[1]);
  return i < 0 ? null : m[2] ? i + 11 : i + 1;
}
const chapterStarts: Partial<Record<'ta' | 'en', Map<number, number>>> = {};
function startsOf(lang: 'ta' | 'en') {
  if (!chapterStarts[lang]) {
    const starts = new Map<number, number>();
    for (const c of TOC[lang === 'ta' ? 'ar' : 'en'].chapters) {
      const no = lang === 'ta' ? arChapterNo(c.title) : Number(c.title.match(/Chapter (\d+)/)?.[1]) || null;
      if (no && c.items[0] && !starts.has(no)) starts.set(no, c.items[0].page);
    }
    chapterStarts[lang] = starts;
  }
  return chapterStarts[lang]!;
}

/** The page in `to` nearest to page `id` of `from`: the same chapter, about as far into it. Tamil and Arabic share
 *  pages; English has its own, so the place is found by chapter. Null when `to` has no page there yet. */
export function samePlaceIn(id: number, from: SLang, to: SLang): number | null {
  if (samePages(from, to)) return hasPage(id, to) ? id : null;
  const a = startsOf(from === 'en' ? 'en' : 'ta');
  const b = startsOf(to === 'en' ? 'en' : 'ta');
  const common = [...a.keys()].filter((k) => b.has(k)).sort((x, y) => x - y);
  const ids = pageIds(to);
  if (!ids.length) return null;
  const i = common.findLastIndex((k) => a.get(k)! <= id);
  if (i < 0) return ids[0]; // before the first chapter (the introductions): the start of the book
  const k = common[i];
  const next = common[i + 1];
  const fromStart = a.get(k)!;
  const toStart = b.get(k)!;
  const fraction = next != null ? Math.min(1, (id - fromStart) / Math.max(1, a.get(next)! - fromStart)) : 0;
  const ideal = next != null ? toStart + fraction * (b.get(next)! - toStart) : toStart + (id - fromStart);
  const inChapter = ids.filter((p) => p >= toStart && (next == null || p < b.get(next)!));
  const pool = inChapter.length ? inChapter : ids;
  return pool.reduce((best, p) => (Math.abs(p - ideal) < Math.abs(best - ideal) ? p : best), pool[0]);
}

/** The TOC entry a page belongs to (the last one starting at or before it). */
export function chapterOf(id: number, lang: SLang) {
  let found: { chapter: string; item: string } | null = null;
  for (const c of TOC[lang].chapters) for (const i of c.items) if (i.page <= id) found = { chapter: c.title, item: i.label };
  return found;
}

/** A label for a page: "Vol 2 · p. 45" / "பாகம் 1 · பக். 45". */
export function pageLabel(id: number, lang: SLang) {
  if (lang === 'en') return `Vol ${volumeOf(id)} · p. ${printedPage(id)}`;
  if (lang === 'ar') return `ج ${volumeOf(id)} · ص ${printedPage(id)}`;
  if (lang === 'ta') return `பாகம் ${volumeOf(id)} · பக். ${printedPage(id)}`;
  return `அத்தியாயம் ${volumeOf(id)} · பக். ${printedPage(id)}`;
}

const LANG_KEY = 'sahaba.lang.v1';
const PROGRESS_KEY = 'sahaba.progress.v1';

/** The edition last chosen for Hayatus Sahaba, else `fallback` (the app language). */
export async function loadLang(fallback: SLang): Promise<SLang> {
  try {
    const v = await AsyncStorage.getItem(LANG_KEY);
    // Arabic and the printed Tamil are no longer offered: those readers continue in Tamil.
    return v === 'en' || v === 'ta' ? v : v === 'ar' || v === 'tp' ? 'ta' : fallback;
  } catch {
    return fallback;
  }
}

export function saveLang(lang: SLang) {
  AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
}

export type SahabaPlace = { page: number; lang: SLang; at: number };

// The last page read, kept per book (each volume is its own book on the shelf).
export const progressKey = (book: number) => `${PROGRESS_KEY}.${book}`;

export function saveProgress(page: number, lang: SLang, book: number) {
  AsyncStorage.setItem(progressKey(book), JSON.stringify({ page, lang, at: Date.now() })).catch(() => {});
}

/** The last page read in this book (volume), re-read every time the screen comes into focus. */
export async function loadLastPage(book: number): Promise<SahabaPlace | null> {
  try {
    const raw = await AsyncStorage.getItem(progressKey(book));
    if (raw) return JSON.parse(raw);
    // Before places were kept per volume: one place for the whole book.
    const old = await AsyncStorage.getItem(PROGRESS_KEY);
    const p: SahabaPlace | null = old ? JSON.parse(old) : null;
    return p && (p.lang === 'en' || p.lang === 'tp' || volumeOf(p.page) === book) ? p : null;
  } catch {
    return null;
  }
}

export function useLastPage(book: number) {
  const [value, setValue] = useState<SahabaPlace | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLastPage(book).then((p) => active && setValue(p));
      return () => {
        active = false;
      };
    }, [book]),
  );
  return value;
}
