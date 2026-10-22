import AsyncStorage from '@react-native-async-storage/async-storage';

import index from '@/assets/data/hadith-books.json';

import { BUNDLED } from './hadith-bundled';

// fawazahmed0/hadith-api — free, no key, public domain. One file per chapter per language.
// jsDelivr is fast but refuses (403) chapters it has not cached yet, because the repo is over its 150 MB limit,
// so fall back to the same file on GitHub.
const MIRRORS = [
  'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions',
  'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions',
];

export type Book = (typeof index.books)[number];
export type Chapter = Book['sections'][number];

export type Hadith = {
  number: number;
  arabic: string;
  english: string;
  tamil: string | null; // where the book has Tamil (see hasTamil)
  narrator: string | null;
  grade: string | null; // e.g. "Sahih (Al-Albani)" where the edition has grades
};

export const BOOKS: Book[] = index.books;

export function getBook(id: string) {
  return BOOKS.find((b) => b.id === id);
}

type EditionSection = {
  hadiths: { hadithnumber: number; text: string; grades?: { name: string; grade: string }[] }[];
};

async function fetchSection(edition: string, section: number): Promise<EditionSection> {
  let offline = true;
  for (const api of MIRRORS) {
    try {
      const res = await fetch(`${api}/${edition}/sections/${section}.min.json`);
      offline = false;
      if (res.ok) return await res.json();
    } catch {
      // try the next mirror
    }
  }
  throw new Error(
    offline ? 'No internet connection. Opened chapters are saved for offline reading.' : 'Could not load this chapter. Please try again.',
  );
}

const NARRATOR = /^Narrated ([^:]{1,80}):\s*/;

// Books with a Tamil translation: Bukhari and Muslim from the same source, and the books bundled in the app
// with our own Tamil (scripts/bundle-hadith.mjs).
const SOURCE_TAMIL = new Set(['bukhari', 'muslim']);
const TAMIL_BOOKS = new Set([...SOURCE_TAMIL, ...Object.keys(BUNDLED)]);

export function hasTamil(book: string) {
  return TAMIL_BOOKS.has(book);
}

/** True when the book's Tamil is our own translation (bundled in the app). */
export function isOurTamil(book: string) {
  return book in BUNDLED;
}

/** Arabic + English (+ Tamil where available) hadith of one chapter, cached on the phone after the first load. */
export async function getChapter(book: string, section: number): Promise<Hadith[]> {
  const bundled = BUNDLED[book]?.[section];
  if (bundled) return bundled() as Hadith[];

  const key = `hadith.chapter.v2.${book}.${section}`;
  try {
    const hit = await AsyncStorage.getItem(key);
    if (hit) return JSON.parse(hit);
  } catch {
    // fall through to the network
  }

  const [eng, ara, tam] = await Promise.all([
    fetchSection(`eng-${book}`, section),
    fetchSection(`ara-${book}`, section),
    SOURCE_TAMIL.has(book) ? fetchSection(`tam-${book}`, section).catch(() => null) : Promise.resolve(null),
  ]);
  const arabicByNumber = new Map(ara.hadiths.map((h) => [h.hadithnumber, h.text]));
  const tamilByNumber = new Map((tam?.hadiths ?? []).filter((h) => h.text.trim()).map((h) => [h.hadithnumber, h.text.trim()]));
  const hadiths: Hadith[] = eng.hadiths
    .filter((h) => h.text.trim())
    .map((h) => {
      const text = h.text.replace(/\s+/g, ' ').trim();
      const m = text.match(NARRATOR);
      const g = h.grades?.[0];
      return {
        number: h.hadithnumber,
        arabic: (arabicByNumber.get(h.hadithnumber) ?? '').trim(),
        english: m ? text.slice(m[0].length) : text,
        tamil: tamilByNumber.get(h.hadithnumber) ?? null,
        narrator: m ? m[1] : null,
        grade: g ? `${g.grade} (${g.name})` : null,
      };
    });

  AsyncStorage.setItem(key, JSON.stringify(hadiths)).catch(() => {});
  return hadiths;
}
