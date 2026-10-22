import AsyncStorage from '@react-native-async-storage/async-storage';

// AlQuran Cloud — free, no API key. Arabic: Uthmani script. English: Saheeh International.
// Audio: one MP3 per ayah, from the reciter / translation edition she picks (see audio options below).
const API = 'https://api.alquran.cloud/v1';
const TEXT_EDITIONS = 'quran-uthmani,en.sahih';

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

/** Translation shown under each ayah. */
export type TextLanguage = 'en' | 'ta';

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

export function getSurah(number: number): Promise<Surah> {
  return cached(`quran.surah.v5.${number}`, async () => {
    const [[arabic, english], tamil] = await Promise.all([
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
      })),
    };
  });
}

/** One MP3 URL per ayah of the surah, for one audio edition. */
export function getSurahAudio(number: number, edition: string): Promise<string[]> {
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
