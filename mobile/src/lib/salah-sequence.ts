import clipSeconds from '@/assets/data/salah-clips.json';
import surahData from '@/assets/data/surah-durations.json';
import jamaatData from '@/assets/data/jamaat-duas.json';
import type { AudioSource } from 'expo-audio';
import { Asset } from 'expo-asset';

import type { RakatKind } from './rakat';
import type { AsrMadhab } from './settings';

// The Namaz Assistant: one whole prayer led aloud like an imam — every takbir, the recitation, ruku and sujood
// tasbih, tashahhud, salawat, the closing dua and salam — then a quiet 2 minutes for your own dua, then the
// Jamaat dua. Surahs are picked at random to fit the chosen length of each rakat.
// Titles and meanings are kept in English here and translated with t() when shown (`vars` fills their placeholders).

export type Length = 'short' | 'medium' | 'long';
export type Speed = 1 | 1.5 | 2;

/** Real seconds one rakat should take (after the speed-up). */
export const LENGTHS: Record<Length, [number, number]> = { short: [60, 120], medium: [120, 240], long: [240, 420] };

type Clip = keyof typeof clipSeconds;

const CLIPS: Partial<Record<Clip, number>> = {
  iqamah: require('@/assets/sounds/salah/iqamah.m4a'),
  takbir: require('@/assets/sounds/salah/takbir.m4a'),
  sana: require('@/assets/sounds/salah/sana.m4a'),
  taawwudh: require('@/assets/sounds/salah/taawwudh.m4a'),
  bismillah: require('@/assets/sounds/salah/bismillah.m4a'),
  ameen: require('@/assets/sounds/salah/ameen.m4a'),
  ruku: require('@/assets/sounds/salah/ruku.m4a'),
  sami: require('@/assets/sounds/salah/sami.m4a'),
  rabbana: require('@/assets/sounds/salah/rabbana.m4a'),
  sujood: require('@/assets/sounds/salah/sujood.m4a'),
  jalsa: require('@/assets/sounds/salah/jalsa.m4a'),
  tashahhud: require('@/assets/sounds/salah/tashahhud.m4a'),
  salawat: require('@/assets/sounds/salah/salawat.m4a'),
  closing: require('@/assets/sounds/salah/closing.m4a'),
  qunut: require('@/assets/sounds/salah/qunut.m4a'),
  salam: require('@/assets/sounds/salah/salam.m4a'),
  'dua-gap': require('@/assets/sounds/salah/dua-gap.m4a'),
  pause: require('@/assets/sounds/salah/pause.m4a'),
};
const SECONDS = clipSeconds as Record<string, number>;

/** What is said in each part, shown while it plays. */
const TEXT: Record<string, { arabic: string; transliteration: string; english: string }> = {
  iqamah: {
    arabic:
      'اللهُ أَكْبَرُ اللهُ أَكْبَرُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللهُ، أَشْهَدُ أَنَّ مُحَمَّدًا رَسُولُ اللهِ، حَيَّ عَلَى الصَّلَاةِ، حَيَّ عَلَى الْفَلَاحِ، قَدْ قَامَتِ الصَّلَاةُ، قَدْ قَامَتِ الصَّلَاةُ، اللهُ أَكْبَرُ اللهُ أَكْبَرُ، لَا إِلَٰهَ إِلَّا اللهُ',
    transliteration: 'Allahu Akbar… Hayya ‘alas-salah, hayya ‘alal-falah. Qad qamatis-salah, qad qamatis-salah…',
    english: 'The Iqamah: the prayer is about to begin. Stand in your row.',
  },
  takbir: { arabic: 'اللهُ أَكْبَر', transliteration: 'Allahu Akbar', english: 'Allah is the Greatest' },
  sana: {
    arabic: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، وَتَبَارَكَ اسْمُكَ، وَتَعَالَى جَدُّكَ، وَلَا إِلَهَ غَيْرُكَ',
    transliteration: 'Subhanaka Allahumma wa bihamdika, wa tabarakasmuka, wa ta‘ala jadduka, wa la ilaha ghayruk',
    english: 'Glory be to You, O Allah, and praise. Blessed is Your name, exalted Your majesty; there is no god but You.',
  },
  taawwudh: {
    arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    transliteration: 'A‘udhu billahi minash-shaytanir-rajim',
    english: 'I seek refuge in Allah from Shaytan, the accursed.',
  },
  bismillah: {
    arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    transliteration: 'Bismillahir-Rahmanir-Rahim',
    english: 'In the name of Allah, the Most Merciful, the Most Kind.',
  },
  fatiha: { arabic: 'سُورَةُ الْفَاتِحَة', transliteration: 'Surah Al-Fatiha', english: 'The Opening' },
  ameen: { arabic: 'آمِين', transliteration: 'Ameen', english: 'O Allah, accept.' },
  ruku: { arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيم', transliteration: 'Subhana Rabbiyal ‘Azeem', english: 'Glory be to my Lord, the Magnificent (×3)' },
  sami: { arabic: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَه', transliteration: 'Sami‘ Allahu liman hamidah', english: 'Allah hears the one who praises Him.' },
  rabbana: {
    arabic: 'رَبَّنَا وَلَكَ الْحَمْدُ، حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيه',
    transliteration: 'Rabbana wa lakal-hamd, hamdan kathiran tayyiban mubarakan fih',
    english: 'Our Lord, to You is all praise, abundant, good and blessed.',
  },
  sujood: { arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى', transliteration: 'Subhana Rabbiyal A‘la', english: 'Glory be to my Lord, the Most High (×3)' },
  jalsa: { arabic: 'رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي', transliteration: 'Rabbighfir li, Rabbighfir li', english: 'My Lord, forgive me. My Lord, forgive me.' },
  tashahhud: {
    arabic:
      'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    transliteration: 'At-tahiyyatu lillahi was-salawatu wat-tayyibat… Ash-hadu an la ilaha illallah, wa ash-hadu anna Muhammadan ‘abduhu wa rasuluh',
    english: 'All greetings, prayers and good things are for Allah… I bear witness that there is no god but Allah, and that Muhammad is His servant and Messenger.',
  },
  salawat: {
    arabic:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    transliteration: 'Allahumma salli ‘ala Muhammadin wa ‘ala ali Muhammad… innaka Hamidum Majid',
    english: 'O Allah, send prayers and blessings upon Muhammad and his family, as You did upon Ibrahim and his family.',
  },
  closing: {
    arabic:
      'اللَّهُمَّ إِنِّي ظَلَمْتُ نَفْسِي ظُلْمًا كَثِيرًا، وَلَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ، فَاغْفِرْ لِي مَغْفِرَةً مِنْ عِنْدِكَ، وَارْحَمْنِي، إِنَّكَ أَنْتَ الْغَفُورُ الرَّحِيمُ',
    transliteration: 'Allahumma inni zalamtu nafsi zulman kathira… innaka antal-Ghafurur-Rahim',
    english: 'O Allah, I have wronged myself greatly and none forgives sins but You, so forgive me and have mercy on me.',
  },
  qunut: {
    arabic: 'اللَّهُمَّ اهْدِنِي فِيمَنْ هَدَيْتَ، وَعَافِنِي فِيمَنْ عَافَيْتَ… تَبَارَكْتَ رَبَّنَا وَتَعَالَيْتَ',
    transliteration: 'Allahummah-dini fiman hadayt… tabarakta Rabbana wa ta‘alayt',
    english: 'O Allah, guide me among those You have guided… Blessed and exalted are You, our Lord. (Qunut of Witr)',
  },
  salam: { arabic: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّه', transliteration: 'Assalamu ‘alaikum wa rahmatullah', english: 'Peace and the mercy of Allah be upon you.' },
  'dua-gap': { arabic: 'وَقْتُ الدُّعَاء', transliteration: 'Time for your dua', english: 'Raise your hands. Two quiet minutes for your own dua.' },
  jamaat: { arabic: 'دُعَاءُ الْجَمَاعَة', transliteration: 'Jamaat dua', english: 'The duas made together after the prayer.' },
};

export type Posture = 'standing' | 'ruku' | 'sujood' | 'sitting' | 'dua';

/** One thing heard, as shown on screen. A step can be several tracks (Fatiha ayahs, tasbih ×3). */
export type Step = {
  key: string;
  title: string;
  arabic: string;
  transliteration: string;
  english: string;
  vars?: Record<string, string | number>; // placeholders in title / english, e.g. {name}
  posture: Posture;
  rakat: number | null; // null after the salam
  tracks: AudioSource[];
  seconds: number; // audio length at 1x
};

export type Salah = { title: string; prayer: string; kind: RakatKind; rakats: number; steps: Step[]; surahs: number[] };

const AYAH_AUDIO = (reciter: string, n: number) => `https://cdn.islamic.network/quran/audio/128/${reciter}/${n}.mp3`;
type SurahInfo = { name: string; ayahs: number[]; seconds: number };
const SURAHS = surahData as Record<string, SurahInfo>;
const FATIHA = SURAHS['1'];
// The surahs offered for after Al-Fatiha, in mushaf order.
const RECITABLE = Object.keys(SURAHS)
  .map(Number)
  .filter((n) => n !== 1)
  .sort((a, b) => a - b);

function clip(key: Clip, posture: Posture, rakat: number | null, title: string, times = 1): Step {
  const source = CLIPS[key];
  const tracks = source == null ? [] : Array(times).fill(source);
  // Every takbir is followed by 2 quiet seconds to move into the next position.
  const pause = key === 'takbir' && CLIPS.pause != null;
  if (pause) tracks.push(CLIPS.pause);
  return {
    key,
    title,
    ...TEXT[key],
    posture,
    rakat,
    tracks,
    seconds: (SECONDS[key] ?? 0) * times + (pause ? SECONDS.pause : 0),
  };
}

function surahStep(surah: number, reciter: string, rakat: number): Step {
  const s = SURAHS[String(surah)];
  return {
    key: `surah-${surah}`,
    title: 'Surah {name}',
    arabic: `سُورَة ${s.name}`,
    transliteration: `Surah ${s.name} (${surah})`,
    english: '{n} ayahs',
    vars: { name: s.name, n: s.ayahs.length },
    posture: 'standing',
    rakat,
    tracks: s.ayahs.map((n) => ({ uri: AYAH_AUDIO(reciter, n) })),
    seconds: s.seconds,
  };
}

/** A random surah after `after` (sunnah order) whose recitation brings the rakat into the chosen length. */
function pickSurah(budget: [number, number], after: number, used: Set<number>) {
  const fresh = RECITABLE.filter((n) => n > after && !used.has(n));
  const pool = fresh.length ? fresh : RECITABLE.filter((n) => !used.has(n));
  const fits = pool.filter((n) => SURAHS[String(n)].seconds >= budget[0] && SURAHS[String(n)].seconds <= budget[1]);
  if (fits.length) return fits[Math.floor(Math.random() * fits.length)];
  // nothing fits: take the closest
  const mid = (budget[0] + budget[1]) / 2;
  return pool.reduce((best, n) =>
    Math.abs(SURAHS[String(n)].seconds - mid) < Math.abs(SURAHS[String(best)].seconds - mid) ? n : best,
  );
}

export type SalahOptions = {
  prayer: string;
  kind: RakatKind;
  rakats: number;
  madhab: AsrMadhab;
  length: Length;
  speed: Speed;
  reciter: string;
  withDua: boolean; // the 2-minute dua time and the Jamaat dua after the salam
};

export function buildSalah(o: SalahOptions): Salah {
  const steps: Step[] = [];
  const surahs: number[] = [];
  const used = new Set<number>();
  const shafi = o.madhab === 'Shafi';
  const witr = o.kind === 'Witr';
  // Fard prayers recite a surah only in the first two rakats; Sunnah, Nafl and Witr in every one.
  const surahIn = (r: number) => o.kind !== 'Fard' || r <= 2;

  // The Iqamah calls the Fard; Sunnah and Nafl start straight with the takbir.
  if (o.kind === 'Fard') steps.push(clip('iqamah', 'standing', null, 'Iqamah'));

  for (let r = 1; r <= o.rakats; r++) {
    const start = steps.length;
    if (r === 1) {
      steps.push(clip('takbir', 'standing', r, 'Takbir al-Ihram'));
      steps.push(clip('sana', 'standing', r, 'Opening dua (Thana)'));
      steps.push(clip('taawwudh', 'standing', r, 'Ta‘awwudh'));
    }
    steps.push({
      key: 'fatiha',
      title: 'Surah Al-Fatiha',
      ...TEXT.fatiha,
      posture: 'standing',
      rakat: r,
      tracks: FATIHA.ayahs.map((n) => ({ uri: AYAH_AUDIO(o.reciter, n) })),
      seconds: FATIHA.seconds,
    });
    // Hanafi: the imam says Ameen quietly. Shafi: aloud.
    if (shafi) steps.push(clip('ameen', 'standing', r, 'Ameen'));

    if (surahIn(r)) {
      const fixed = rakatSeconds(r, o, steps.slice(start));
      const [lo, hi] = LENGTHS[o.length];
      const budget: [number, number] = [Math.max(0, lo * o.speed - fixed), Math.max(20, hi * o.speed - fixed)];
      const surah = pickSurah(budget, surahs[surahs.length - 1] ?? 1, used);
      used.add(surah);
      surahs.push(surah);
      steps.push(clip('bismillah', 'standing', r, 'Bismillah'));
      steps.push(surahStep(surah, o.reciter, r));
    }
    if (witr && r === o.rakats && !shafi) {
      steps.push(clip('takbir', 'standing', r, 'Takbir for Qunut'));
      steps.push(clip('qunut', 'standing', r, 'Dua al-Qunut'));
    }

    steps.push(clip('takbir', 'ruku', r, 'Takbir · going to Ruku'));
    steps.push(clip('ruku', 'ruku', r, 'Ruku', 3));
    steps.push(clip('sami', 'standing', r, 'Rising from Ruku'));
    steps.push(clip('rabbana', 'standing', r, 'Standing after Ruku'));
    if (witr && r === o.rakats && shafi) steps.push(clip('qunut', 'standing', r, 'Dua al-Qunut'));
    steps.push(clip('takbir', 'sujood', r, 'Takbir · first Sajdah'));
    steps.push(clip('sujood', 'sujood', r, 'Sajdah', 3));
    steps.push(clip('takbir', 'sitting', r, 'Takbir · sitting'));
    steps.push(clip('jalsa', 'sitting', r, 'Between the two Sajdahs'));
    steps.push(clip('takbir', 'sujood', r, 'Takbir · second Sajdah'));
    steps.push(clip('sujood', 'sujood', r, 'Sajdah', 3));

    const last = r === o.rakats;
    if (last) {
      steps.push(clip('takbir', 'sitting', r, 'Takbir · final sitting'));
      steps.push(clip('tashahhud', 'sitting', r, 'Tashahhud (Attahiyat)'));
      steps.push(clip('salawat', 'sitting', r, 'Salawat (Durood Ibrahim)'));
      steps.push(clip('closing', 'sitting', r, 'Dua before Salam'));
      steps.push(clip('salam', 'sitting', r, 'Salam · to the right'));
      steps.push(clip('salam', 'sitting', r, 'Salam · to the left'));
    } else if (r === 2) {
      steps.push(clip('takbir', 'sitting', r, 'Takbir · first sitting'));
      steps.push(clip('tashahhud', 'sitting', r, 'Tashahhud (Attahiyat)'));
      steps.push(clip('takbir', 'standing', r, 'Takbir · standing for the next Rakat'));
    } else {
      steps.push(clip('takbir', 'standing', r, 'Takbir · standing for the next Rakat'));
    }
  }

  if (o.withDua) {
    steps.push(clip('dua-gap', 'dua', null, 'Time for dua'));
    steps.push({
      key: 'jamaat',
      title: 'Jamaat dua',
      ...TEXT.jamaat,
      posture: 'dua',
      rakat: null,
      tracks: jamaatData.duas.flatMap((d) => d.ayahs.map((a) => ({ uri: a.audio }))),
      seconds: 0,
    });
  }

  return { title: `${o.prayer} ${o.kind} · ${o.rakats} Rakat`, prayer: o.prayer, kind: o.kind, rakats: o.rakats, steps, surahs };
}

/** Seconds of everything in rakat `r` except its surah (already-built steps plus the fixed parts still to come). */
function rakatSeconds(r: number, o: SalahOptions, sofar: Step[]) {
  const s = (k: string) => SECONDS[k] ?? 0;
  let t = sofar.reduce((n, st) => n + st.seconds, 0) + s('bismillah');
  t += (s('takbir') + s('pause')) * 4 + s('ruku') * 3 + s('sami') + s('rabbana') + s('sujood') * 6 + s('jalsa');
  if (r === o.rakats) t += s('takbir') + s('pause') + s('tashahhud') + s('salawat') + s('closing') + s('salam') * 2;
  else if (r === 2) t += (s('takbir') + s('pause')) * 2 + s('tashahhud');
  else t += s('takbir') + s('pause');
  return t;
}

/**
 * A bundled clip (a require() number) as { uri, assetId }. A native playlist's add() takes the source as it is,
 * and on Android a bare number crashes it (only the web build resolves it), so every clip goes in as a uri.
 */
function playable(source: AudioSource): AudioSource {
  if (typeof source !== 'number') return source;
  const asset = Asset.fromModule(source);
  return { uri: asset.localUri ?? asset.uri, assetId: source };
}

/** Each audio track, and which step it belongs to. */
export function flatten(salah: Salah) {
  const tracks: AudioSource[] = [];
  const stepOf: number[] = [];
  salah.steps.forEach((st, i) => {
    for (const t of st.tracks) {
      tracks.push(playable(t));
      stepOf.push(i);
    }
  });
  return { tracks, stepOf };
}
