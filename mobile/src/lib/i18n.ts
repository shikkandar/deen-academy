import { TA } from '@/i18n';

import { saveBookLanguage } from './book-language';
import type { Language } from './settings';

// App text in English and Tamil (dictionaries in src/i18n/ta-*.ts). The English text is the key; anything missing in
// Tamil falls back to English. `{name}` placeholders are filled from `vars`.

const DICTS: Record<Language, Record<string, string>> = { en: {}, ta: TA };

// The language the app is in right now, for text built outside components (notifications, alerts, constants evaluated
// at render time). app-state keeps it in step with Settings → App language.
let current: Language = 'en';

export function setCurrentLanguage(language: Language) {
  current = language;
}

/** Choosing an app language also makes every book open in it (each book keeps its own switch inside). */
export function applyAppLanguage(language: Language) {
  current = language;
  saveBookLanguage(language);
}

/** The text in the app's current language (outside components; inside them use `useT()` so they re-render). */
export function tr(text: string, vars?: Record<string, string | number>) {
  return makeT(current)(text, vars);
}

export type T = (text: string, vars?: Record<string, string | number>) => string;

export function makeT(language: Language): T {
  const dict = DICTS[language] ?? {};
  return (text, vars) => {
    let out = dict[text] ?? text;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}

/** Locale for dates in the chosen language. */
export function localeFor(language: Language) {
  return language === 'ta' ? 'ta-IN' : undefined;
}
