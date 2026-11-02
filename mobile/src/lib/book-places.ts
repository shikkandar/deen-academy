import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";

import { hadithHref, type HadithProgress } from "./reading-progress";
import { loadLastPage, printedPage, volumeFor } from "./sahaba";

// Where the reader stopped in each book on the Library shelf, so every book can offer "Continue" from its own last page.

export type BookPlace = { href: Href; page?: number; hadith?: number };

async function loadPlaces(ids: string[]): Promise<Record<string, BookPlace>> {
  const out: Record<string, BookPlace> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        if (id === "muntakhab") {
          const raw = await AsyncStorage.getItem("muntakhab.progress.v1");
          const p = raw ? (JSON.parse(raw) as { page: number }) : null;
          if (p)
            out[id] = {
              href: `/hadith/muntakhab/${p.page}` as Href,
              page: p.page,
            };
        } else if (/^sahaba\d$/.test(id)) {
          const book = Number(id.slice(-1));
          const p = await loadLastPage(book);
          if (p) {
            const vol = volumeFor(p.lang, book) ?? book;
            out[id] = {
              href: `/hadith/sahaba/${p.page}?lang=${p.lang}&vol=${vol}` as Href,
              page: printedPage(p.page),
            };
          }
        } else {
          const raw = await AsyncStorage.getItem(
            `reading.hadith.book.v1.${id}`,
          );
          const p = raw ? (JSON.parse(raw) as HadithProgress) : null;
          if (p) out[id] = { href: hadithHref(p), hadith: p.hadithNumber };
        }
      } catch {}
    }),
  );
  return out;
}

/** The last place in each of these books, re-read whenever the screen comes into focus. */
export function useBookPlaces(ids: string[]) {
  const [places, setPlaces] = useState<Record<string, BookPlace>>({});
  const key = ids.join(",");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadPlaces(key.split(",")).then((p) => active && setPlaces(p));
      return () => {
        active = false;
      };
    }, [key]),
  );
  return places;
}
