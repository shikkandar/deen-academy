import { CalculationParameters, Madhab } from 'adhan';

import type { AsrMadhab } from './settings';
import type { Coords } from './prayer';

// Rough outline of Tamil Nadu (with Puducherry and Karaikal), [longitude, latitude], pushed a little out to sea on the coast.
const OUTLINE: [number, number][] = [
  [80.45, 13.6], [80.1, 13.55], [79.75, 13.3], [79.35, 13.05], [78.95, 13.05], [78.45, 12.95], [78.2, 12.95],
  [77.9, 12.85], [77.65, 12.6], [77.45, 12.2], [77.0, 11.9], [76.85, 11.75], [76.4, 11.65], [76.25, 11.45],
  [76.5, 11.25], [76.7, 11.05], [76.82, 10.78], [76.82, 10.55], [76.9, 10.3], [77.15, 10.15], [77.25, 9.95],
  [77.22, 9.6], [77.15, 9.2], [77.2, 8.9], [77.15, 8.55], [77.1, 8.3], [77.4, 8.0], [77.6, 7.95], [78.3, 8.6],
  [78.4, 8.85], [79.5, 9.1], [79.5, 9.4], [79.45, 10.1], [80.0, 10.3], [80.0, 11.0], [79.95, 11.5], [80.35, 12.5],
  [80.45, 13.1],
];

export function inTamilNadu({ latitude, longitude }: Coords) {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > latitude !== yj > latitude && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Minutes added to Fajr/Isha at 18° (and to sunrise, noon, the Asr shadow and sunset) on the 15th of each month, Jan..Dec,
// fitted to the Karur timetable of Jamaat-ul-Ulama Karur; days in between blend the two nearest months. Within a minute of
// the timetable on every row of it. Winter (Nov-Feb) Fajr, Maghrib and Isha sit about 3 minutes later than the rest of the year.
type Knots = number[];
const ADJUST: Record<string, Knots> = {
  fajr: [0.1, -1.2, -3.3, -3.3, -3.4, -3.5, -4.1, -4.5, -3.3, -2.4, 0.2, -0.8],
  sunrise: [-0.4, -0.7, -0.2, -0.2, -0.1, -0.3, -1.2, -0.8, -0.7, -0.6, -0.4, -0.2],
  dhuhr: [15.3, 15.3, 15.5, 15.3, 15.2, 15.4, 15.2, 15.1, 15.1, 15.4, 15.5, 15.2], // Zuhr is 15 minutes after zawal
  asrShafi: [5, 5.1, 5.2, 5.3, 5.2, 5.3, 4.6, 5.6, 5, 5.7, 5.8, 5.4],
  asrHanafi: [1.9, 2.1, 2.1, 2.3, 1.8, 2.3, 2.2, 2.5, 2.2, 2.6, 2.2, 2.4],
  maghrib: [9.1, 7.5, 5.3, 4.8, 5.7, 6, 6.2, 6.3, 5.9, 6.4, 9.5, 8.6], // the timetable's Maghrib (Iftar), not the bare sunset
  ishaShafi: [8.6, 6.7, 4.2, 5.5, 5, 5.5, 5.5, 5.6, 5.4, 5.5, 8.5, 7.9],
  ishaHanafi: [16.7, 14.8, 13.2, 13.1, 13.8, 14.5, 14.7, 14.4, 13.6, 13.8, 17.2, 16.9],
};

/** The chart row a date is read from: its month's 1st, 6th, 12th, 18th or 24th, whichever last came. */
export function chartDay(date: Date) {
  const row = [24, 18, 12, 6, 1].find((d) => d <= date.getDate()) ?? 1;
  return new Date(date.getFullYear(), date.getMonth(), row);
}

/** The knots' value on this date, blended between the 15th of this month and the 15th of the month before or after. */
function on(date: Date, knots: Knots) {
  const daysIn = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const p = (date.getMonth() + (date.getDate() - 15) / daysIn + 12) % 12;
  const i = Math.floor(p);
  const f = p - i;
  return knots[i] * (1 - f) + knots[(i + 1) % 12] * f;
}

/** Calculation for Tamil Nadu: Fajr and Isha at 18°, with the Karur Ulama's minutes for the day. Isha follows the madhab too. */
export function tamilNaduParams(date: Date, madhab: AsrMadhab) {
  const hanafi = madhab === 'Hanafi';
  const params = new CalculationParameters('Other', 18, 18);
  params.madhab = hanafi ? Madhab.Hanafi : Madhab.Shafi;
  params.adjustments = {
    fajr: on(date, ADJUST.fajr),
    sunrise: on(date, ADJUST.sunrise),
    dhuhr: on(date, ADJUST.dhuhr),
    asr: on(date, hanafi ? ADJUST.asrHanafi : ADJUST.asrShafi),
    maghrib: on(date, ADJUST.maghrib),
    isha: on(date, hanafi ? ADJUST.ishaHanafi : ADJUST.ishaShafi),
  };
  return params;
}
