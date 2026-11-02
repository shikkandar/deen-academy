import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (the prayer is being led, the Quran is reciting), and lets it sleep
 * again as soon as that ends. Each caller uses its own `tag`, so one ending doesn't switch off the other.
 */
export function useKeepAwakeWhile(active: boolean, tag: string) {
  useEffect(() => {
    if (!active) return;
    activateKeepAwakeAsync(tag).catch(() => {
      // not available here (e.g. a browser without the Wake Lock API)
    });
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [active, tag]);
}
