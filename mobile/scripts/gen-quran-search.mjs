#!/usr/bin/env node
// The Library search reads the whole Quran from one compact file per language, as it does Muntakhab Ahadith and
// Hayatus Sahaba. This downloads the same texts the reader shows — the Uthmani Arabic, Sahih International (English)
// and Jalandhry (Urdu) from alquran.cloud, and Omar Sharif's Tamil from QuranEnc — and writes
// assets/quran/search-{ar,en,ur,ta}.json (served as /data/quran/search-*.json): one row per ayah, [surah, ayah, text].
// Run it again only to refresh the texts (they are committed).
//   node scripts/gen-quran-search.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'assets/quran');
fs.mkdirSync(DIR, { recursive: true });

async function json(url) {
  for (let tries = 0; ; tries++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (tries >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (tries + 1)));
    }
  }
}

function write(lang, rows) {
  const out = path.join(DIR, `search-${lang}.json`);
  fs.writeFileSync(out, JSON.stringify(rows));
  console.log(`${path.relative(ROOT, out)}: ${rows.length} ayahs, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}

for (const [lang, edition] of [['ar', 'quran-uthmani'], ['en', 'en.sahih'], ['ur', 'ur.jalandhry']]) {
  const { data } = await json(`https://api.alquran.cloud/v1/quran/${edition}`);
  write(lang, data.surahs.flatMap((s) => s.ayahs.map((a) => [s.number, a.numberInSurah, a.text])));
}

const tamil = [];
for (let s = 1; s <= 114; s++) {
  const { result } = await json(`https://quranenc.com/api/v1/translation/sura/tamil_omar_brief/${s}`);
  for (const a of result) tamil.push([s, Number(a.aya), a.translation]);
}
write('ta', tamil);
