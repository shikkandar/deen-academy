import { getData } from './remote-data';
import type { SLang } from './sahaba';

// One compact file per language (written by scripts/sahaba/gen-pages.mjs), fetched only when Hayatus Sahaba is
// searched — fetching thousands of page files one by one would be far too slow. The apps use it too (kept on the phone).

export type SahabaRow = [page: number, block: number, text: string];

export async function sahabaRows(lang: SLang, _yieldToUi?: () => Promise<unknown>): Promise<SahabaRow[]> {
  const rows = await getData(`/data/sahaba/search-${lang}.json`);
  return Array.isArray(rows) ? (rows as SahabaRow[]) : [];
}
