import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

// Where she stopped reading, kept on the phone so the Quran and Hadith pick up where she left off.

export type QuranProgress = {
  surah: number;
  surahName: string;
  ayah: number; // 1-based ayah number in the surah
  total: number;
  at: number; // when, ms
};

export type HadithProgress = {
  book: string;
  bookName: string;
  section: number;
  chapterName: string;
  index: number; // position in the chapter list (for scrolling back)
  hadithNumber: number;
  at: number;
};

const KEYS = { quran: 'reading.quran.v1', hadith: 'reading.hadith.v1' } as const;

// Scrolling fires many updates a second — write at most every 1.5 s per kind.
const pending: Partial<Record<keyof typeof KEYS, { value: unknown; timer: ReturnType<typeof setTimeout> }>> = {};

function saveSoon(kind: keyof typeof KEYS, value: unknown) {
  const p = pending[kind];
  if (p) {
    p.value = value;
    return;
  }
  const entry = {
    value,
    timer: setTimeout(() => {
      AsyncStorage.setItem(KEYS[kind], JSON.stringify(entry.value)).catch(() => {});
      delete pending[kind];
    }, 1500),
  };
  pending[kind] = entry;
}

export function saveQuranProgress(p: Omit<QuranProgress, 'at'>) {
  saveSoon('quran', { ...p, at: Date.now() });
}

export function saveHadithProgress(p: Omit<HadithProgress, 'at'>) {
  saveSoon('hadith', { ...p, at: Date.now() });
}

async function load<T>(kind: keyof typeof KEYS): Promise<T | null> {
  const p = pending[kind];
  if (p) return p.value as T; // not written yet, but newest
  try {
    const raw = await AsyncStorage.getItem(KEYS[kind]);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Where she stopped in the Quran (or null). */
export function loadQuranProgress() {
  return load<QuranProgress>('quran');
}

/** The saved position, re-read every time the screen comes into focus. */
export function useProgress<K extends keyof typeof KEYS>(kind: K) {
  const [value, setValue] = useState<(K extends 'quran' ? QuranProgress : HadithProgress) | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      load<K extends 'quran' ? QuranProgress : HadithProgress>(kind).then((v) => active && setValue(v));
      return () => {
        active = false;
      };
    }, [kind]),
  );
  return value;
}

export function quranHref(p: QuranProgress): Href {
  return `/quran/${p.surah}?ayah=${p.ayah}` as Href;
}

export function hadithHref(p: HadithProgress): Href {
  return `/hadith/${p.book}/${p.section}?at=${p.index}` as Href;
}

export function timeAgo(at: number, t: (text: string, vars?: Record<string, string | number>) => string = (x, v) => x.replace('{n}', String(v?.n ?? ''))) {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return t('just now');
  if (mins < 60) return t('{n} min ago', { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('{n}h ago', { n: hours });
  const days = Math.round(hours / 24);
  return days === 1 ? t('yesterday') : t('{n} days ago', { n: days });
}
