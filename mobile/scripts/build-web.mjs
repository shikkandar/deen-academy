#!/usr/bin/env node
// Builds the web app into dist/ for Netlify: expo export, the hadith/Muntakhab data files (fetched when opened),
// and the tags that let iPhone/Android users add it to the Home Screen as an app (PWA).
//   node scripts/build-web.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });

run('node scripts/gen-web-loaders.mjs');
fs.rmSync(DIST, { recursive: true, force: true });
run('npx expo export --platform web --output-dir dist');

// public/data links into assets/: make sure real files ended up in dist/data
for (const dir of ['hadith', 'muntakhab']) {
  // expo export copies the links themselves (absolute paths), which Netlify can't upload: replace them with files
  const dest = path.join(DIST, 'data', dir);
  try {
    fs.unlinkSync(dest);
  } catch {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(path.join(ROOT, 'assets', dir), dest, { recursive: true, dereference: true });
}

const tags = [
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<meta name="theme-color" content="#2F6B4F" />',
  '<meta name="description" content="Prayer times, Azan and Iqamah, Namaz Assistant, Qibla, Quran and Tamil hadith." />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Deen Academy" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
].join('\n    ');
const indexFile = path.join(DIST, 'index.html');
const html = fs.readFileSync(indexFile, 'utf8').replace('</head>', `    ${tags}\n  </head>`);
fs.writeFileSync(indexFile, html.replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"'));
console.log('web build ready in dist/');
