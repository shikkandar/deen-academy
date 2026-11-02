import AsyncStorage from '@react-native-async-storage/async-storage';

// The language books open in (Settings → Book language). Each book still has its own switch inside; choosing a
// language here sets every book's choice to it, so they all open in that language from now on.

export type BookLanguage = 'en' | 'ta';

const KEY = 'books.lang.v1';
// Each book's own saved choice (see lib/hadith-books, lib/muntakhab, lib/sahaba).
const BOOK_KEYS = ['hadith.translation.v1', 'muntakhab.lang.v1', 'sahaba.lang.v1'];

export async function loadBookLanguage(): Promise<BookLanguage> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'en' ? 'en' : 'ta';
  } catch {
    return 'ta';
  }
}

export function saveBookLanguage(lang: BookLanguage) {
  AsyncStorage.multiSet([[KEY, lang], ...BOOK_KEYS.map((k) => [k, lang] as [string, string])]).catch(() => {});
}
