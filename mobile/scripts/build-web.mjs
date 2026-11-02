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
run('node scripts/sahaba/gen-pages.mjs');
fs.rmSync(DIST, { recursive: true, force: true });
run('npx expo export --platform web --output-dir dist');

// public/data links into assets/: make sure real files ended up in dist/data
for (const dir of ['hadith', 'muntakhab', 'sahaba', 'wordtimes']) {
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
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=2" />',
  '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png?v=2" />',
  '<meta name="theme-color" content="#2F6B4F" />',
  '<meta name="description" content="Prayer times, Azan and Iqamah, Namaz Assistant, Qibla, Quran and Tamil hadith." />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Deen Academy" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
].join('\n    ');
// Shown while the app's JavaScript loads (the page is blank until then); React replaces #root's contents, and the
// script below removes it in case the app mounts elsewhere.
const BOOT_LOADER = `<div id="boot" style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#F7F1E3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;z-index:9999">
      <img src="/icon-192.png" width="96" height="96" alt="" style="border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,.18);animation:bootPulse 1.6s ease-in-out infinite" />
      <div style="font-size:22px;font-weight:700;color:#134A33;letter-spacing:.3px">Deen Academy</div>
      <div style="width:34px;height:34px;border-radius:50%;border:3px solid #134A3333;border-top-color:#134A33;animation:bootSpin .9s linear infinite"></div>
      <div style="font-size:13px;color:#134A33;opacity:.7">Learn and live your deen</div>
      <style>@keyframes bootSpin{to{transform:rotate(360deg)}}@keyframes bootPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}</style>
    </div>`;
const indexFile = path.join(DIST, 'index.html');
const html = fs
  .readFileSync(indexFile, 'utf8')
  .replace('</head>', `    ${tags}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root"></div>\n    ${BOOT_LOADER}\n    <script>new MutationObserver((m, o) => { if (document.getElementById('root').childElementCount) { document.getElementById('boot')?.remove(); o.disconnect(); } }).observe(document.getElementById('root'), { childList: true });</script>`);
fs.writeFileSync(indexFile, html.replace('content="width=device-width, initial-scale=1, shrink-to-fit=no"', 'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"'));
console.log('web build ready in dist/');
