#!/usr/bin/env node
// Lists every t('…') / tr('…') text in src that has no Tamil in src/i18n (so nothing stays English in Tamil mode).
//   node scripts/i18n-check.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dict = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'src/i18n')).filter((f) => f.startsWith('ta-'))) {
  const src = fs.readFileSync(path.join(ROOT, 'src/i18n', f), 'utf8');
  for (const m of src.matchAll(/^\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z_][\w]*))\s*:/gm))
    dict.add((m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"'));
}
const missing = new Map();
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name) && !p.includes('/i18n/')) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/\bt[r]?\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`)/g)) {
        const k = (m[1] ?? m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (!dict.has(k)) missing.set(k, path.relative(ROOT, p));
      }
    }
  }
};
walk(path.join(ROOT, 'src'));
for (const [k, f] of missing) console.log(`${f}: ${k}`);
console.log(`${dict.size} Tamil texts, ${missing.size} missing`);
