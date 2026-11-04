import AsyncStorage from '@react-native-async-storage/async-storage';

import { WORD_TIMES } from './word-times';

// AlQuran Cloud — free, no API key. Arabic: Uthmani script. English: Saheeh International. Urdu: Jalandhry.
// Audio: one MP3 per ayah, from the reciter / translation edition she picks (see audio options below).
const API = 'https://api.alquran.cloud/v1';
const TEXT_EDITIONS = 'quran-uthmani,en.sahih,ur.jalandhry';

// Tamil translation text and audio: Omar Sharif (abridged), from QuranEnc.com — free to republish unchanged,
// with credit and the version number. Both are streamed from QuranEnc, not packaged in the app.
const QURANENC = 'https://quranenc.com/api/v1/translation/sura/tamil_omar_brief';
const QURANENC_AUDIO = 'https://d.quranenc.com/data/audio/tamil_omar_brief';
export const TAMIL_EDITION = 'ta.omar';
export const TAMIL_CREDIT = 'Tamil translation and audio: Omar Sharif (abridged) · QuranEnc.com · v1.0.2';

export const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit Abdus-Samad' },
  { id: 'ar.abdurrahmaansudais', name: 'Abdurrahmaan As-Sudais' },
  { id: 'ar.saoodshuraym', name: "Saood Ash-Shuraym" },
  { id: 'ar.mahermuaiqly', name: 'Maher Al Muaiqly' },
  { id: 'ar.husary', name: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', name: 'Mohamed Siddiq Al-Minshawi' },
  { id: 'ar.abdullahbasfar', name: 'Abdullah Basfar' },
] as const;

export type ReciterId = (typeof RECITERS)[number]['id'];

/** Spoken translation played after (or instead of) the Arabic recitation. */
export type Voice = 'none' | 'english' | 'tamil' | 'urdu';

export const VOICES: { id: Voice; label: string }[] = [
  { id: 'none', label: 'Off' },
  { id: 'english', label: 'English' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'urdu', label: 'Urdu' },
];

const VOICE_EDITION: Record<Exclude<Voice, 'none'>, string> = {
  english: 'en.walk', // Ibrahim Walk, Saheeh International
  tamil: TAMIL_EDITION,
  urdu: 'ur.khan', // Shamshad Ali Khan
};

/** Translation shown under each ayah, or none (the Arabic only). */
export type TextLanguage = 'en' | 'ta' | 'ur' | 'off';

/** The language a spoken-translation edition speaks, or null for the Arabic recitation. */
export function voiceLanguage(edition: string): Exclude<TextLanguage, 'off'> | null {
  const voice = (Object.keys(VOICE_EDITION) as (keyof typeof VOICE_EDITION)[]).find((v) => VOICE_EDITION[v] === edition);
  return voice === 'english' ? 'en' : voice === 'tamil' ? 'ta' : voice === 'urdu' ? 'ur' : null;
}

/** An ayah's translation in `lang` (English if that one is missing), or null when translations are off. */
export function translationOf(a: Ayah, lang: TextLanguage): string | null {
  if (lang === 'off') return null;
  return (lang === 'ta' ? a.tamil : lang === 'ur' ? a.urdu : '') || a.english;
}

/** What plays for each ayah: the Arabic recitation, a spoken translation, or both (Arabic first). */
export type AudioPrefs = { arabic: boolean; voice: Voice; reciter: ReciterId; translation?: TextLanguage };

const DEFAULT_AUDIO: AudioPrefs = { arabic: true, voice: 'none', reciter: 'ar.alafasy' };
const AUDIO_PREFS_KEY = 'quran.audioPrefs.v1';

export async function loadAudioPrefs(): Promise<AudioPrefs> {
  try {
    const raw = await AsyncStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return DEFAULT_AUDIO;
    const { mode, ...saved } = JSON.parse(raw);
    const prefs: AudioPrefs = { ...DEFAULT_AUDIO, ...saved };
    // Older versions saved one combined "mode" (e.g. "arabic+tamil").
    if (typeof mode === 'string') {
      prefs.arabic = mode.startsWith('arabic');
      prefs.voice = (['english', 'tamil', 'urdu'] as const).find((v) => mode.includes(v)) ?? 'none';
    }
    return prefs;
  } catch {
    return DEFAULT_AUDIO;
  }
}

export function saveAudioPrefs(prefs: AudioPrefs) {
  AsyncStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

/** The audio editions to play for each ayah, in order. */
export function editionsFor({ arabic, voice, reciter }: AudioPrefs): string[] {
  const editions = [...(arabic ? [reciter] : []), ...(voice !== 'none' ? [VOICE_EDITION[voice]] : [])];
  return editions.length ? editions : [reciter];
}

export type SurahInfo = {
  number: number;
  name: string; // Arabic
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan';
};

export type Ayah = {
  number: number; // across the whole Quran
  numberInSurah: number;
  arabic: string;
  english: string;
  tamil: string;
  urdu: string;
};

export type Surah = SurahInfo & { ayahs: Ayah[] };

// Every surah except Al-Fatiha (where it is ayah 1) and At-Tawbah (which has none) starts with the
// Bismillah inside ayah 1's text. We show it once as a header instead.
export const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

export function hasBismillahHeader(surah: number) {
  return surah !== 1 && surah !== 9;
}

// Letters only: drop the BOM, harakat and Quranic marks, and read alef wasla as a plain alef. The API's
// Bismillah varies in mark order (shadda/fatha) and sometimes carries an extra shadda, so compare skeletons.
const MARKS = /[\uFEFF\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const skeleton = (t: string) => t.replace(MARKS, '').replace(/\u0671/g, '\u0627');
const BISMILLAH_SKELETON = skeleton(BISMILLAH);

/** Ayah 1's text without the leading Bismillah (which is shown once as a header). */
function stripBismillah(text: string) {
  const words = text.replace(/^\uFEFF/, '').split(' ');
  return skeleton(words.slice(0, 4).join(' ')) === BISMILLAH_SKELETON ? words.slice(4).join(' ').trim() : text;
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await AsyncStorage.getItem(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // fall through to the network
  }
  const value = await load();
  AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  return value;
}

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`);
  } catch {
    throw new Error('No internet connection. Opened surahs are saved for offline reading.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.code !== 200) throw new Error('Could not load the Quran right now. Please try again.');
  return body.data as T;
}

export function getSurahList(): Promise<SurahInfo[]> {
  return cached('quran.surahs.v1', () => get<SurahInfo[]>('/surah'));
}

type EditionAyah = { number: number; numberInSurah: number; text: string; audio?: string };
type EditionSurah = SurahInfo & { ayahs: EditionAyah[] };

/** Tamil text per ayah, in order; empty strings if QuranEnc can't be reached (Arabic and English still load). */
async function getTamil(number: number): Promise<string[]> {
  try {
    const res = await fetch(`${QURANENC}/${number}`);
    const body = await res.json();
    return (body.result as { translation: string }[]).map((a) => a.translation);
  } catch {
    return [];
  }
}

export async function getSurah(number: number): Promise<Surah> {
  const key = `quran.surah.v6.${number}`;
  const surah = await loadSurah(number, key);
  // Saved while QuranEnc couldn't be reached: the Tamil is missing (English showed instead), so fetch it again.
  if (surah.ayahs.length && surah.ayahs.every((a) => !a.tamil)) {
    const tamil = await getTamil(number);
    if (tamil.length) {
      const fixed = { ...surah, ayahs: surah.ayahs.map((a, i) => ({ ...a, tamil: tamil[i] ?? '' })) };
      AsyncStorage.setItem(key, JSON.stringify(fixed)).catch(() => {});
      return fixed;
    }
  }
  return surah;
}

function loadSurah(number: number, key: string): Promise<Surah> {
  return cached(key, async () => {
    const [[arabic, english, urdu], tamil] = await Promise.all([
      get<EditionSurah[]>(`/surah/${number}/editions/${TEXT_EDITIONS}`),
      getTamil(number),
    ]);
    const { ayahs: _, ...info } = arabic;
    return {
      ...info,
      ayahs: arabic.ayahs.map((a, i) => ({
        number: a.number,
        numberInSurah: a.numberInSurah,
        arabic: i === 0 && hasBismillahHeader(number) ? stripBismillah(a.text) : a.text,
        english: english.ayahs[i].text,
        tamil: tamil[i] ?? '',
        urdu: urdu?.ayahs[i]?.text ?? '',
      })),
    };
  });
}

// Quran.com: the same reciters' recordings with the time of every word (to highlight the word being recited),
// and the Uthmani text split into those same words.
const QURAN_COM = 'https://api.quran.com/api/v4';
const QURAN_COM_AUDIO = 'https://verses.quran.com/';
const WORD_TIMED: Partial<Record<string, number>> = {
  'ar.alafasy': 7,
  'ar.abdulbasitmurattal': 2,
  'ar.abdurrahmaansudais': 3,
  'ar.saoodshuraym': 10,
  'ar.husary': 6,
  'ar.minshawi': 9,
};

/** When each word of an ayah is said (ms from the start of the ayah's MP3): [start, end] per word, or null for a
 * shown "word" that is not said (a dash). */
export type WordTimes = ([number, number] | null)[];
type TimedAudio = { urls: string[]; times: WordTimes[] };

// Recitations whose word times we made (forced alignment against the shown text), per surah: the spoken
// translations, and Arabic reciters Quran.com has no timings for (against its words).
const OWN_TIMED = WORD_TIMES;

/** Whether this audio edition knows when each word is said. */
export function hasWordTimes(edition: string) {
  return WORD_TIMED[edition] != null || edition in OWN_TIMED;
}

async function quranCom<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${QURAN_COM}${path}`);
  } catch {
    throw new Error('No internet connection. Opened surahs are saved for offline reading.');
  }
  if (!res.ok) throw new Error('Could not load the recitation right now. Please try again.');
  return (await res.json()) as T;
}

type Segment = [number | string, number | string, number | string, number | string]; // index, word, start, end
type QuranComAudio = { audio_files: { verse_key: string; url: string; segments?: Segment[] }[] };

function getTimedAudio(number: number, recitation: number): Promise<TimedAudio> {
  return cached(`quran.timed.v1.${recitation}.${number}`, async () => {
    const { audio_files } = await quranCom<QuranComAudio>(`/recitations/${recitation}/by_chapter/${number}?fields=segments&per_page=300`);
    const files = [...audio_files].sort((a, b) => Number(a.verse_key.split(':')[1]) - Number(b.verse_key.split(':')[1]));
    return {
      urls: files.map((f) => (f.url.startsWith('//') ? `https:${f.url}` : f.url.startsWith('http') ? f.url : QURAN_COM_AUDIO + f.url)),
      times: files.map((f) => {
        const times: WordTimes = [];
        for (const [, word, start, end] of f.segments ?? []) times[Number(word) - 1] = [Number(start), Number(end)];
        return Array.from(times, (t) => t ?? null);
      }),
    };
  });
}

/** The time of every word of every ayah, for an edition that has them (see hasWordTimes). */
export async function getWordTimes(number: number, edition: string): Promise<WordTimes[]> {
  const own = OWN_TIMED[edition]?.[number];
  if (own) return ((await own()) as WordTimes[] | null) ?? [];
  const id = WORD_TIMED[edition];
  return id == null ? [] : (await getTimedAudio(number, id)).times;
}

type QuranComVerses = { verses: { verse_key: string; words: { char_type_name: string; text_uthmani: string }[] }[] };

/** Each ayah's Arabic as its words (the ones the word times count), without the ayah-number sign. */
export function getSurahWords(number: number): Promise<string[][]> {
  return cached(`quran.words.v1.${number}`, async () => {
    const { verses } = await quranCom<QuranComVerses>(
      `/verses/by_chapter/${number}?words=true&word_fields=text_uthmani&per_page=300`,
    );
    return verses.map((v) => v.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani));
  });
}

/** One MP3 URL per ayah of the surah, for one audio edition. */
export function getSurahAudio(number: number, edition: string): Promise<string[]> {
  const timed = WORD_TIMED[edition];
  if (timed != null) return getTimedAudio(number, timed).then((t) => t.urls);
  return cached(`quran.audio.v1.${edition}.${number}`, async () => {
    if (edition === TAMIL_EDITION) {
      const info = (await getSurahList()).find((x) => x.number === number);
      const pad = (n: number) => String(n).padStart(3, '0');
      return Array.from({ length: info?.numberOfAyahs ?? 0 }, (_, i) => `${QURANENC_AUDIO}/${pad(number)}${pad(i + 1)}.mp3`);
    }
    const surah = await get<EditionSurah>(`/surah/${number}/${edition}`);
    return surah.ayahs.map((a) => a.audio ?? '');
  });
}
