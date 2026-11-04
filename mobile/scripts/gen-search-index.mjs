#!/usr/bin/env node
// The Library search reads Muntakhab Ahadith from one compact file per language instead of its 1,824 page files
// (fetching those one by one took minutes on a phone). This writes assets/muntakhab/search-ta.json and search-en.json
// (served as /data/muntakhab/search-*.json): one row per text, [page, block, hadith number or 0, text], in page order.
// A page missing in English falls back to the Tamil page, as the reader does.
//   node scripts/gen-search-index.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'assets/muntakhab');
const ids = (lang) => fs.readdirSync(path.join(DIR, lang)).filter((f) => /^\d+\.json$/.test(f));
const pages = [...new Set([...ids('ta'), ...ids('en')])].sort((a, b) => parseInt(a) - parseInt(b));

for (const lang of ['ta', 'en']) {
  const rows = [];
  for (const f of pages) {
    const file = fs.existsSync(path.join(DIR, lang, f)) ? path.join(DIR, lang, f) : path.join(DIR, 'ta', f);
    if (!fs.existsSync(file)) continue;
    const page = JSON.parse(fs.readFileSync(file, 'utf8'));
    (page.blocks ?? []).forEach((b, block) => {
      const texts =
        b.type === 'quran'
          ? [b.arabic_text, b.tamil_translation, b.surah_reference_tamil]
          : b.type === 'hadith'
            ? [b.narrator, b.arabic_text, b.tamil_translation, b.source_reference_tamil]
            : [b.text];
      const hadith = b.type === 'hadith' && !b.continued ? Number(b.hadith_number) || 0 : 0;
      for (const text of texts) if (text?.trim()) rows.push([parseInt(f), block, hadith, text]);
    });
  }
  const out = path.join(DIR, `search-${lang}.json`);
  fs.writeFileSync(out, JSON.stringify(rows));
  console.log(`${path.relative(ROOT, out)}: ${rows.length} texts, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}
