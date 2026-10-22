import data from '@/assets/data/namaz-hadith.json';

import type { PrayerName } from './prayer';

export type Hadith = {
  id: string;
  hadithNumber: number;
  bookName: string;
  narrator: string | null;
  text: string;
  prayers: string[];
  source: string;
};

// Long hadith don't fit the card, so it draws from the shorter ones.
const MAX_CARD_LENGTH = 500;

const NARRATOR = /^Narrated ([^:]{1,80}): /;

const POOL: Hadith[] = data.hadith
  .map((h) => {
    const m = h.english.match(NARRATOR);
    return {
      id: h.id,
      hadithNumber: h.hadithNumber,
      bookName: h.bookName,
      narrator: m ? m[1] : null,
      text: m ? h.english.slice(m[0].length) : h.english,
      // Tagged in the JSON by which prayer the hadith mentions; the Friday chapter is "Jummah".
      prayers: h.prayers,
      source: h.source,
    };
  })
  .filter((h) => h.text.length <= MAX_CARD_LENGTH);

const BY_PRAYER = new Map<string, Hadith[]>();
for (const h of POOL) for (const p of h.prayers) BY_PRAYER.set(p, [...(BY_PRAYER.get(p) ?? []), h]);

/**
 * A random-looking hadith about `prayer` that stays the same for that prayer: picked by hashing
 * `seed` (the prayer's time) with `pick` (how many times she tapped for another one).
 */
export function hadithFor(prayer: PrayerName, seed: number, pick = 0): Hadith {
  const pool = BY_PRAYER.get(prayer) ?? POOL;
  let x = (Math.floor(seed / 60_000) + Math.imul(pick, 7919)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return pool[(x >>> 0) % pool.length];
}
