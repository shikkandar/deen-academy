import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

import type { MasjidPrayer, MasjidTime, Settings } from './settings';
import { chartDay, inTamilNadu, tamilNaduParams } from './tamil-nadu';

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Jummah' | 'Asr' | 'Maghrib' | 'Isha';

/** `time` is the Azan. `jamaat` is set only when her masjid's board gives one. */
export type PrayerTime = { name: PrayerName; time: Date; jamaat: Date | null };

export type Coords = { latitude: number; longitude: number };

/** "HH:MM" on the given day. */
function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

/** The clock time of `time`, on `day`. */
function sameTimeOn(day: Date, time: Date) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), time.getSeconds());
}

export function getDayTimes(coords: Coords, date: Date, settings: Settings) {
  // In Tamil Nadu the Karachi method follows the Karur Ulama's timetable, read like the printed chart: each day takes
  // the times of its row (the 1st, 6th, 12th, 18th or 24th).
  const tamilNadu = settings.method === 'Karachi' && inTamilNadu(coords);
  const day = tamilNadu ? chartDay(date) : date;
  const params = tamilNadu ? tamilNaduParams(day, settings.madhab) : CalculationMethod[settings.method]();
  params.madhab = settings.madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const calc = new PrayerTimes(new Coordinates(coords.latitude, coords.longitude), day, params);
  const at = (time: Date) => sameTimeOn(date, time);
  const t = { fajr: at(calc.fajr), sunrise: at(calc.sunrise), dhuhr: at(calc.dhuhr), asr: at(calc.asr), maghrib: at(calc.maghrib), isha: at(calc.isha) };

  const masjid = settings.masjid.enabled ? settings.masjid.times : null;
  const isFriday = date.getDay() === 5;
  const jummah = masjid && isFriday && (masjid.jummah.azan || masjid.jummah.jamaat) ? masjid.jummah : null;

  const make = (name: PrayerName, calculated: Date, key: MasjidPrayer, override?: MasjidTime | null): PrayerTime => {
    const m = override ?? masjid?.[key];
    const time = m?.azan ? atTime(date, m.azan) : calculated;
    // Without the masjid board's Jamaat, the Iqamah is estimated from the Azan (see dueTime).
    const jamaat = m?.jamaat ? atTime(date, m.jamaat) : null;
    return { name, time, jamaat };
  };

  const prayers: PrayerTime[] = [
    make('Fajr', t.fajr, 'fajr'),
    jummah ? make('Jummah', t.dhuhr, 'jummah', jummah) : make('Dhuhr', t.dhuhr, 'dhuhr'),
    make('Asr', t.asr, 'asr'),
    make('Maghrib', t.maghrib, 'maghrib'),
    make('Isha', t.isha, 'isha'),
  ];
  // Sahar ends 20 minutes before Fajr and Iftar is at Maghrib (the Karur Ulama's chart); Zawal is solar noon, before
  // Dhuhr's minutes (15 in Tamil Nadu) were added.
  const noonAdjust = tamilNadu ? 15 : params.adjustments.dhuhr + params.methodAdjustments.dhuhr;
  const minute = (ms: number) => new Date(Math.round(ms / 60_000) * 60_000);
  const extras = {
    sahar: minute(t.fajr.getTime() - 20 * 60_000),
    zawal: minute(t.dhuhr.getTime() - noonAdjust * 60_000),
    iftar: t.maghrib,
  };
  return { prayers, sunrise: t.sunrise, extras };
}

/** Prayers from today onwards for the given number of days. */
export function getUpcoming(coords: Coords, settings: Settings, days: number, from = new Date()) {
  const out: PrayerTime[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push(...getDayTimes(coords, day, settings).prayers);
  }
  return out;
}

export function getNextPrayer(coords: Coords, settings: Settings, now = new Date()) {
  return getUpcoming(coords, settings, 2, now).find((p) => p.time > now)!;
}

/** When the "Namaz due" reminder fires: the masjid Jamaat if known, else a fixed gap after the Azan. */
export function dueTime(p: PrayerTime, settings: Settings) {
  return p.jamaat ?? new Date(p.time.getTime() + settings.afterMinutes * 60_000);
}

/** The prayer happening right now — from its Azan until the Namaz (Jamaat + the DND length) is over — or null. */
export function getCurrentPrayer(coords: Coords, settings: Settings, now = new Date()) {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return (
    getUpcoming(coords, settings, 2, yesterday).find((p) => {
      const end = dueTime(p, settings).getTime() + settings.dndMinutes * 60_000;
      return p.time <= now && now.getTime() < end;
    }) ?? null
  );
}

/** The most recent prayer whose Azan has passed (today's, or last night's Isha just after midnight). */
export function getLastPrayer(coords: Coords, settings: Settings, now = new Date()) {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return getUpcoming(coords, settings, 2, yesterday).filter((p) => p.time <= now).at(-1) ?? null;
}

/**
 * The prayer whose time is still running, even after the Jamaat: from its Azan until the next prayer's Azan
 * (Isha until Fajr), except Fajr, which ends at sunrise. Null between sunrise and Dhuhr, when no fard is due.
 */
export function getPrayerWindow(coords: Coords, settings: Settings, now = new Date()) {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const list = getUpcoming(coords, settings, 3, yesterday);
  let i = -1;
  list.forEach((p, k) => {
    if (p.time <= now) i = k;
  });
  if (i < 0) return null;
  const prayer = list[i];
  const endsAt = prayer.name === 'Fajr' ? getDayTimes(coords, prayer.time, settings).sunrise : list[i + 1]?.time;
  if (!endsAt || now >= endsAt) return null;
  return { prayer, endsAt };
}

/** "After namaz" time: from the Jamaat / "Namaz due" time until an hour after the namaz (DND) window. */
export function isAfterNamaz(p: PrayerTime, settings: Settings, now = new Date()) {
  const start = dueTime(p, settings).getTime();
  return now.getTime() >= start && now.getTime() < start + (settings.dndMinutes + 60) * 60_000;
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}
