import { File, Paths } from 'expo-file-system';

import { DATA_URL } from '@/constants/app';

// Native: a book file (`/data/...json`) comes from the phone's copy when there is one, otherwise from the web app on
// Netlify, and is then kept on the phone (documents/data/...), so whatever has been opened once works offline.
// The web build has its own twin (remote-data.web.ts) that just fetches from its own site.

const inFlight = new Map<string, Promise<unknown>>();

function local(path: string) {
  return new File(Paths.document, path.replace(/^\//, ''));
}

async function load(path: string): Promise<unknown> {
  const file = local(path);
  try {
    if (file.exists) return JSON.parse(await file.text());
  } catch {
    // a half-written or damaged copy: fetch it again below
  }
  let text: string;
  try {
    const res = await fetch(DATA_URL + path);
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null; // offline and not on the phone yet
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null; // not JSON (e.g. the site's HTML page for a file it doesn't have)
  }
  try {
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    await file.write(text);
  } catch {
    // couldn't save it; it still opens now and is fetched again next time
  }
  return json;
}

/** One `/data/...json` file only if it is already saved on the phone (opened before), else null; never downloads. */
export async function getSavedData(path: string): Promise<unknown> {
  const file = local(path);
  try {
    return file.exists ? JSON.parse(await file.text()) : null;
  } catch {
    return null;
  }
}

/** One `/data/...json` file, from the phone if saved there, otherwise downloaded once and saved. */
export function getData(path: string): Promise<unknown> {
  let p = inFlight.get(path);
  if (!p) {
    p = load(path).finally(() => inFlight.delete(path));
    inFlight.set(path, p);
  }
  return p;
}
