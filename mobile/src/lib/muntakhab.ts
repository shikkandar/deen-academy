import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import tocEn from '@/assets/muntakhab/toc-en.json';
import tocTa from '@/assets/muntakhab/toc-ta.json';

import { PAGE_NUMBERS, PAGES } from './muntakhab-pages';

// Muntakhab Ahadith, from the publisher's own data (Tamil, with the English translation page for page).

export type MLang = 'ta' | 'en';

export type Block =
  | { type: 'heading'; level: 'chapter' | 'topic' | 'section'; text: string }
  | { type: 'paragraph'; text: string; continued?: boolean }
  | {
      type: 'quran';
      verse_number?: number;
      arabic_text?: string;
      surah_reference?: string;
      tamil_translation?: string; // the translation, in either language
      surah_reference_tamil?: string;
      continued?: boolean;
    }
  | {
      type: 'hadith';
      hadith_number: number;
      narrator?: string;
      arabic_text?: string;
      source_reference_arabic?: string;
      tamil_translation?: string;
      source_reference_tamil?: string;
      continued?: boolean;
    }
  | { type: 'explanation'; text: string; continued?: boolean };

export type Page = { header: { book_title: string; running_head: string; page_number: number }; blocks: Block[] };

export type TocItem = { label: string; page: number };
export type Toc = { title: string; chapters: { title: string; items: TocItem[] }[] };

export const TOC: Record<MLang, Toc> = { ta: tocTa as Toc, en: tocEn as Toc };
export const FIRST_PAGE = PAGE_NUMBERS[0];
export const LAST_PAGE = PAGE_NUMBERS[PAGE_NUMBERS.length - 1];

export function getPage(n: number, lang: MLang): Page | null {
  const load = PAGES[lang][n] ?? PAGES.ta[n];
  if (!load) return null;
  const page = load() as Page;
  return page?.blocks ? page : null;
}

/** The chapter a page belongs to (the last one starting at or before it). */
export function chapterOf(n: number, lang: MLang) {
  let found: { chapter: string; item: string } | null = null;
  for (const c of TOC[lang].chapters) for (const i of c.items) if (i.page <= n) found = { chapter: c.title, item: i.label };
  return found;
}

const LANG_KEY = 'muntakhab.lang.v1';
const PROGRESS_KEY = 'muntakhab.progress.v1';

/** The language last chosen for Muntakhab, else `fallback` (the app language). */
export async function loadLang(fallback: MLang): Promise<MLang> {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    return saved === 'en' || saved === 'ta' ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function saveLang(lang: MLang) {
  AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
}

export function saveProgress(page: number) {
  AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify({ page, at: Date.now() })).catch(() => {});
}

/** The last page read, re-read every time the screen comes into focus. */
export function useLastPage() {
  const [value, setValue] = useState<{ page: number; at: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(PROGRESS_KEY)
        .then((raw) => active && setValue(raw ? JSON.parse(raw) : null))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );
  return value;
}
