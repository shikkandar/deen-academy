import { useMemo } from 'react';

import { useAppState } from '@/lib/app-state';
import { makeT } from '@/lib/i18n';

/** Translate app text into the language chosen in Settings. */
export function useT() {
  const { settings } = useAppState();
  return useMemo(() => makeT(settings.language), [settings.language]);
}
