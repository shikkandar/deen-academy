import { cancelDnd, hasDndAccess, isDndSupported, scheduleDndWindows } from '../../modules/prayer-dnd';

import { dueTime, getUpcoming, type Coords } from './prayer';
import type { Settings } from './settings';

const DAYS_AHEAD = 5;

/**
 * Do Not Disturb turns on at the "Namaz due" reminder (the masjid Jamaat when known) and stays on for `dndMinutes`.
 * It starts after the Azan and the reminder, so neither of those gets silenced.
 */
export function scheduleDnd(coords: Coords, settings: Settings) {
  if (!isDndSupported) return;
  if (!settings.dnd || !hasDndAccess()) {
    cancelDnd();
    return;
  }
  const windows = getUpcoming(coords, settings, DAYS_AHEAD).map((p) => {
    const start = dueTime(p, settings).getTime() + 30_000; // just after the reminder / Jamaat start
    return { start, end: start + settings.dndMinutes * 60_000 };
  });
  scheduleDndWindows(windows);
}
