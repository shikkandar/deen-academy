#!/usr/bin/env node
// Generates short Arabic prayer phrases with Gemini TTS, as 24 kHz mono WAV files.
// The key comes from GEMINI_API_KEY in the environment or in mobile/.env (git-ignored).
//   node scripts/gemini-tts.mjs <outDir> <voice> <name>=<arabic text> ...

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const envFile = path.join(root, '.env');
const key =
  process.env.GEMINI_API_KEY ??
  (fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m)?.[1].trim() : undefined);
if (!key) throw new Error('Set GEMINI_API_KEY (in the environment or mobile/.env)');

const [outDir, voice, ...items] = process.argv.slice(2);
if (!outDir || !voice || !items.length) {
  console.error('usage: node scripts/gemini-tts.mjs <outDir> <voice> <name>=<arabic text> ...');
  process.exit(1);
}
// The pro TTS model has no free tier; flash does.
const MODEL = process.env.TTS_MODEL ?? 'gemini-2.5-flash-preview-tts';

/** 16-bit mono PCM -> WAV. */
function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

fs.mkdirSync(outDir, { recursive: true });
for (const item of items) {
  const [name, text] = item.split('=');
  const prompt =
    'Read this in classical Arabic exactly as an imam says it aloud in congregational prayer: ' +
    'a calm, deep, reverent male voice, clear tajweed, unhurried, no music. Say only these words: ' +
    text;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  const json = await res.json();
  const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) {
    console.error(name, res.status, JSON.stringify(json).slice(0, 300));
    continue;
  }
  const file = path.join(outDir, `${name}-${voice}.wav`);
  fs.writeFileSync(file, wav(Buffer.from(data, 'base64')));
  console.log('wrote', file);
}
