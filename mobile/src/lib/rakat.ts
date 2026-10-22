import type { PrayerName } from './prayer';
import type { AsrMadhab } from './settings';

export type RakatKind = 'Fard' | 'Sunnah' | 'Witr' | 'Nafl';

/** One unit of the prayer, in the order it's prayed. `optional` = non-emphasised (ghair mu'akkadah). */
export type Rakat = { count: number; kind: RakatKind; optional?: boolean };

const S = (count: number, optional = false): Rakat => ({ count, kind: 'Sunnah', optional });
const F = (count: number): Rakat => ({ count, kind: 'Fard' });
const W = (count: number): Rakat => ({ count, kind: 'Witr' });
const N = (count: number): Rakat => ({ count, kind: 'Nafl' });

// Commonly taught rakat charts. Masjids and families may differ slightly, especially for optional ones.
const CHART: Record<AsrMadhab, Record<PrayerName, Rakat[]>> = {
  Hanafi: {
    Fajr: [S(2), F(2)],
    Dhuhr: [S(4), F(4), S(2), N(2)],
    Jummah: [S(4), F(2), S(4), S(2), N(2)],
    Asr: [S(4, true), F(4)],
    Maghrib: [F(3), S(2), N(2)],
    Isha: [S(4, true), F(4), S(2), N(2), W(3), N(2)],
  },
  Shafi: {
    Fajr: [S(2), F(2)],
    Dhuhr: [S(2), F(4), S(2)],
    Jummah: [S(2), F(2), S(2)],
    Asr: [S(4, true), F(4)],
    Maghrib: [S(2, true), F(3), S(2)],
    Isha: [S(2, true), F(4), S(2), W(3)],
  },
};

export function rakatFor(prayer: PrayerName, madhab: AsrMadhab) {
  const parts = CHART[madhab][prayer];
  return { parts, total: parts.reduce((n, p) => n + p.count, 0) };
}
