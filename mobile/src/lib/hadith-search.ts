import AsyncStorage from '@react-native-async-storage/async-storage';

import { BOOKS, type Hadith } from './hadith-books';
import { BUNDLED } from './hadith-bundled';
import type { T } from './i18n';
import { getPage, type MLang } from './muntakhab';
import { PAGE_NUMBERS } from './muntakhab-pages';

// One search over every hadith text on the phone: all of Muntakhab Ahadith (Tamil and English, offline),
// every hadith book's chapter titles, every hadith bundled in the app (with our Tamil), and the hadith of every
// chapter already opened (saved for offline).
// Same rules as the Muntakhab web edition: Arabic vowel marks are ignored, look-alike letters are folded,
// every word must appear, and whole-phrase matches come first.

const DROP = /[ؐ-ًؚ-ٰٟۖ-ۭـ​-‍⁠]/;
const FOLD: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه', 'ک': 'ك', 'ی': 'ي',
};

/** The searchable form of `s`, and for each of its characters the index it came from in `s`. */
function normalize(s: string) {
  let norm = '';
  const from: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (DROP.test(c)) continue;
    norm += (FOLD[c] ?? c).toLowerCase();
    from.push(i);
  }
  return { norm, from };
}
const normOnly = (s: string) => normalize(s).norm;

export type Where =
  | { kind: 'muntakhab'; lang: MLang; page: number; block: number; hadith?: number }
  | { kind: 'chapter'; book: string; name: string; section: number }
  | { kind: 'hadith'; book: string; name: string; section: number; index: number; number: number };

/** Where a hit is, in the app language (worked out when shown, so a language change applies at once). */
export function whereLabel(w: Where, t: T) {
  if (w.kind === 'muntakhab') {
    const at = t('{lang} · page {n}', { lang: t(w.lang === 'ta' ? 'Tamil' : 'English'), n: w.page });
    return w.hadith != null ? `${at} · ${t('hadith {n}', { n: w.hadith })}` : at;
  }
  if (w.kind === 'chapter') return `${w.name} · ${t('chapter {n}', { n: w.section })}`;
  return `${w.name} · ${w.number}`;
}

type Doc = { where: Where; text: string; norm: string };

export type Hit = { where: Where; parts: { text: string; mark: boolean }[]; cutStart: boolean; cutEnd: boolean; exact: boolean };

// ---------------- the index ----------------

let muntakhab: Promise<Doc[]> | null = null;

const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

/** Every text on every Muntakhab page, both languages. Built once, in slices so the screen stays smooth. */
function muntakhabDocs(): Promise<Doc[]> {
  if (muntakhab) return muntakhab;
  muntakhab = (async () => {
    const docs: Doc[] = [];
    for (const lang of ['ta', 'en'] as const) {
      for (let i = 0; i < PAGE_NUMBERS.length; i++) {
        const n = PAGE_NUMBERS[i];
        const page = getPage(n, lang);
        page?.blocks.forEach((b, block) => {
          const texts =
            b.type === 'quran'
              ? [b.arabic_text, b.tamil_translation, b.surah_reference_tamil]
              : b.type === 'hadith'
                ? [b.narrator, b.arabic_text, b.tamil_translation, b.source_reference_tamil]
                : [b.text];
          const hadith = b.type === 'hadith' && !b.continued ? b.hadith_number : undefined;
          for (const text of texts) {
            if (text?.trim()) docs.push({ where: { kind: 'muntakhab', lang, page: n, block, hadith }, text, norm: normOnly(text) });
          }
        });
        if (i % 60 === 59) await yieldToUi();
      }
    }
    return docs;
  })();
  return muntakhab;
}

let titles: Doc[] | null = null;

/** Chapter titles of every hadith book. */
function chapterDocs(): Doc[] {
  if (!titles) {
    titles = BOOKS.flatMap((b) =>
      b.sections.map((s) => ({
        where: { kind: 'chapter', book: b.id, name: b.name, section: s.id } as Where,
        text: s.name,
        norm: normOnly(s.name),
      })),
    );
  }
  return titles;
}

function addChapter(docs: Doc[], book: string, section: number, hadiths: Hadith[]) {
  const name = BOOKS.find((b) => b.id === book)?.name ?? book;
  hadiths.forEach((h, index) => {
    const where: Where = { kind: 'hadith', book, name, section, index, number: h.number };
    for (const text of [h.english, h.tamil, h.arabic, h.narrator]) {
      if (text?.trim()) docs.push({ where, text, norm: normOnly(text) });
    }
  });
}

let bundled: Promise<Doc[]> | null = null;

/** Every hadith bundled in the app. Built once, in slices so the screen stays smooth. */
function bundledDocs(): Promise<Doc[]> {
  if (bundled) return bundled;
  bundled = (async () => {
    const docs: Doc[] = [];
    for (const [book, sections] of Object.entries(BUNDLED)) {
      for (const [section, load] of Object.entries(sections)) {
        addChapter(docs, book, Number(section), load() as Hadith[]);
        await yieldToUi();
      }
    }
    return docs;
  })();
  return bundled;
}

/** The hadith of every chapter saved on the phone (opened at least once). Re-read on every search. */
async function savedHadithDocs(): Promise<Doc[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('hadith.chapter.v2.'));
    const rows = await AsyncStorage.multiGet(keys);
    const docs: Doc[] = [];
    for (const [key, raw] of rows) {
      if (!raw) continue;
      const [, , , book, section] = key.split('.');
      if (BUNDLED[book]?.[Number(section)]) continue; // already in bundledDocs
      addChapter(docs, book, Number(section), JSON.parse(raw) as Hadith[]);
    }
    return docs;
  } catch {
    return [];
  }
}

/** Start building the Muntakhab index early (e.g. when the search screen opens). */
export function warmUp() {
  muntakhabDocs();
  bundledDocs();
}

// ---------------- searching ----------------

const END = /[.!?؟۔\n]/;
const MAX = 220;

/** Ranges [start, end) in `text` where any of `terms` occur. */
export function findRanges(text: string, terms: string[]): [number, number][] {
  const { norm, from } = normalize(text);
  const out: [number, number][] = [];
  for (const t of terms) {
    let i = norm.indexOf(t);
    while (i !== -1) {
      out.push([from[i], from[i + t.length - 1] + 1]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  out.sort((a, b) => a[0] - b[0]);
  // marks that follow the last matched letter belong with it
  for (const r of out) while (r[1] < text.length && DROP.test(text[r[1]])) r[1]++;
  return out;
}

export const queryTerms = (q: string) => normOnly(q.trim()).split(/\s+/).filter(Boolean);

/** Split `text` into plain and marked parts for every term (for highlighting a whole text). */
export function markParts(text: string, terms: string[]) {
  const parts: { text: string; mark: boolean }[] = [];
  let at = 0;
  for (const [a, b] of findRanges(text, terms)) {
    if (b <= at) continue;
    const a2 = Math.max(a, at);
    if (a2 > at) parts.push({ text: text.slice(at, a2), mark: false });
    parts.push({ text: text.slice(a2, b), mark: true });
    at = b;
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: false });
  return parts;
}

function snippet(doc: Doc, terms: string[], phrase: string): Hit {
  const text = doc.text;
  const ranges = findRanges(text, terms);
  const pi = doc.norm.indexOf(phrase);
  const anchor = pi !== -1 ? (findRanges(text, [phrase])[0]?.[0] ?? 0) : (ranges[0]?.[0] ?? 0);

  // the sentence the match is in; a very long one becomes a window around the match
  let s = anchor;
  while (s > 0 && !END.test(text[s - 1])) s--;
  let e = anchor;
  while (e < text.length && !END.test(text[e])) e++;
  if (e < text.length) e++;
  if (e - s > MAX) {
    const ws = Math.max(s, anchor - 80);
    const we = Math.min(e, ws + MAX);
    s = ws === s ? s : text.indexOf(' ', ws) + 1 || ws;
    e = we === e ? e : text.lastIndexOf(' ', we) > s ? text.lastIndexOf(' ', we) : we;
  }
  while (s < e && text[s] === ' ') s++;

  const parts: Hit['parts'] = [];
  let at = s;
  for (const [a, b] of ranges) {
    if (b <= at || a >= e) continue;
    const a2 = Math.max(a, at);
    if (a2 > at) parts.push({ text: text.slice(at, a2), mark: false });
    const b2 = Math.min(b, e);
    parts.push({ text: text.slice(a2, b2), mark: true });
    at = b2;
  }
  if (at < e) parts.push({ text: text.slice(at, e), mark: false });
  return { where: doc.where, parts, cutStart: s > 0, cutEnd: e < text.length, exact: pi !== -1 };
}

const sameSpot = (a: Where, b: Where) => JSON.stringify(a) === JSON.stringify(b);

function run(docs: Doc[], terms: string[], phrase: string, limit: number) {
  const exact: Doc[] = [];
  const rest: Doc[] = [];
  for (const d of docs) {
    if (!terms.every((t) => d.norm.includes(t))) continue;
    // one hit per block / hadith (its Arabic and translation would otherwise both show)
    const list = d.norm.includes(phrase) ? exact : rest;
    const prev = list[list.length - 1];
    if (prev && sameSpot(prev.where, d.where)) continue;
    list.push(d);
  }
  const all = exact.concat(rest);
  return { hits: all.slice(0, limit).map((d) => snippet(d, terms, phrase)), total: all.length };
}

export type Results = Record<'muntakhab' | 'chapters' | 'hadith', { hits: Hit[]; total: number }>;

export async function searchAll(q: string, limit = 60): Promise<Results | null> {
  const terms = queryTerms(q);
  if (!terms.length || terms.join('').length < 2) return null;
  const phrase = terms.join(' ');
  const [m, inApp, saved] = await Promise.all([muntakhabDocs(), bundledDocs(), savedHadithDocs()]);
  return {
    muntakhab: run(m, terms, phrase, limit),
    chapters: run(chapterDocs(), terms, phrase, limit),
    hadith: run(inApp.concat(saved), terms, phrase, limit),
  };
}
