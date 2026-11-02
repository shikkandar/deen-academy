import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

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

type Kind = 'quran' | 'hadith';
type Place<K extends Kind> = K extends 'quran' ? QuranProgress : HadithProgress;

// The last few places she read, newest first, one per surah / hadith chapter, so one stray tap can't lose the others.
const KEYS = { quran: 'reading.quran.v2', hadith: 'reading.hadith.v2' } as const;
const OLD_KEYS = { quran: 'reading.quran.v1', hadith: 'reading.hadith.v1' } as const; // the single place saved before
const KEEP = 3;
// A page only counts as read once it has been open this long, so opening one by mistake changes nothing.
const MIN_READ_MS = 10_000;

const idOf = (kind: Kind, p: QuranProgress | HadithProgress) =>
  kind === 'quran' ? String((p as QuranProgress).surah) : `${(p as HadithProgress).book}/${(p as HadithProgress).section}`;

// Loaded once, then kept in memory; the phone's copy is rewritten at most every 1.5 s while she scrolls.
const lists: Partial<Record<Kind, Promise<(QuranProgress | HadithProgress)[]>>> = {};
function places<K extends Kind>(kind: K): Promise<Place<K>[]> {
  lists[kind] ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS[kind]);
      if (raw) return JSON.parse(raw);
      const old = await AsyncStorage.getItem(OLD_KEYS[kind]);
      return old ? [JSON.parse(old)] : [];
    } catch {
      return [];
    }
  })();
  return lists[kind] as Promise<Place<K>[]>;
}

const writeTimers: Partial<Record<Kind, ReturnType<typeof setTimeout>>> = {};
async function remember(kind: Kind, place: QuranProgress | HadithProgress) {
  const list = await places(kind);
  const others = list.filter((p) => idOf(kind, p) !== idOf(kind, place));
  list.splice(0, list.length, place, ...others.slice(0, KEEP - 1));
  clearTimeout(writeTimers[kind]);
  writeTimers[kind] = setTimeout(() => AsyncStorage.setItem(KEYS[kind], JSON.stringify(list)).catch(() => {}), 1500);
}

// The page open right now: places seen in its first seconds are held back until it has been open long enough.
type Session = { opened: number; held: QuranProgress | HadithProgress | null; timer?: ReturnType<typeof setTimeout> };
const sessions: Partial<Record<Kind, Session>> = {};

function save(kind: Kind, place: QuranProgress | HadithProgress) {
  const s = sessions[kind];
  const wait = s ? s.opened + MIN_READ_MS - Date.now() : 0;
  if (!s || wait <= 0) {
    remember(kind, place);
    return;
  }
  s.held = place;
  s.timer ??= setTimeout(() => {
    if (sessions[kind] === s && s.held) remember(kind, s.held);
  }, wait);
}

/** While a surah / hadith chapter is open: what it shows counts as read only after MIN_READ_MS. */
export function useReadingSession(kind: Kind, page: string) {
  useEffect(() => {
    const s: Session = { opened: Date.now(), held: null };
    sessions[kind] = s;
    return () => {
      clearTimeout(s.timer);
      if (sessions[kind] === s) delete sessions[kind];
    };
  }, [kind, page]);
}

export function saveQuranProgress(p: Omit<QuranProgress, 'at'>) {
  save('quran', { ...p, at: Date.now() });
}

export function saveHadithProgress(p: Omit<HadithProgress, 'at'>) {
  save('hadith', { ...p, at: Date.now() });
  // and the last place in this book, for the Library shelf (kept even when other books push it out of the list above)
  AsyncStorage.setItem(`reading.hadith.book.v1.${p.book}`, JSON.stringify({ ...p, at: Date.now() })).catch(() => {});
}

/** Where she last was in this surah (or null). */
export async function loadQuranPlace(surah: number) {
  return (await places('quran')).find((p) => p.surah === surah) ?? null;
}

/** The recent places, newest first, re-read every time the screen comes into focus. */
export function useRecent<K extends Kind>(kind: K) {
  const [value, setValue] = useState<Place<K>[]>([]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      places(kind).then((list) => active && setValue([...list]));
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
