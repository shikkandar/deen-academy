import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

import type { MasjidPrayer, MasjidTime, Settings } from './settings';

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Jummah' | 'Asr' | 'Maghrib' | 'Isha';

/** `time` is the Azan. `jamaat` is set only when her masjid's board gives one. */
export type PrayerTime = { name: PrayerName; time: Date; jamaat: Date | null };

export type Coords = { latitude: number; longitude: number };

/** "HH:MM" on the given day. */
function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

// Dhuhr is at a fixed time every day (Azan 12:45, Iqamah 1:15) unless the masjid board gives its own.
const FIXED_DHUHR: MasjidTime = { azan: '12:45', jamaat: '13:15' };

export function getDayTimes(coords: Coords, date: Date, settings: Settings) {
  const params = CalculationMethod[settings.method]();
  params.madhab = settings.madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const t = new PrayerTimes(new Coordinates(coords.latitude, coords.longitude), date, params);

  const masjid = settings.masjid.enabled ? settings.masjid.times : null;
  const isFriday = date.getDay() === 5;
  const jummah = masjid && isFriday && (masjid.jummah.azan || masjid.jummah.jamaat) ? masjid.jummah : null;

  const make = (name: PrayerName, calculated: Date, key: MasjidPrayer, override?: MasjidTime | null): PrayerTime => {
    const own = override ?? masjid?.[key];
    const m = key === 'dhuhr' && !own?.azan && !own?.jamaat ? FIXED_DHUHR : own;
    const time = m?.azan ? atTime(date, m.azan) : calculated;
    // Maghrib's Iqamah is straight after the Azan unless the masjid board says otherwise.
    const jamaat = m?.jamaat ? atTime(date, m.jamaat) : name === 'Maghrib' ? time : null;
    return { name, time, jamaat };
  };

  const prayers: PrayerTime[] = [
    make('Fajr', t.fajr, 'fajr'),
    jummah ? make('Jummah', t.dhuhr, 'jummah', jummah) : make('Dhuhr', t.dhuhr, 'dhuhr'),
    make('Asr', t.asr, 'asr'),
    make('Maghrib', t.maghrib, 'maghrib'),
    make('Isha', t.isha, 'isha'),
  ];
  return { prayers, sunrise: t.sunrise };
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
