import AsyncStorage from '@react-native-async-storage/async-storage';

export type CalcMethod = 'Karachi' | 'MuslimWorldLeague' | 'UmmAlQura' | 'Egyptian' | 'NorthAmerica' | 'Dubai';
export type AsrMadhab = 'Shafi' | 'Hanafi';

export type MasjidPrayer = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'jummah';
/** 24-hour "HH:MM" from the masjid board, or null when not set. */
export type MasjidTime = { azan: string | null; jamaat: string | null };

export type Masjid = {
  enabled: boolean;
  name: string;
  times: Record<MasjidPrayer, MasjidTime>;
  updatedAt: number | null;
};

const EMPTY_TIME: MasjidTime = { azan: null, jamaat: null };

export const EMPTY_MASJID: Masjid = {
  enabled: false,
  name: '',
  times: { fajr: EMPTY_TIME, dhuhr: EMPTY_TIME, asr: EMPTY_TIME, maghrib: EMPTY_TIME, isha: EMPTY_TIME, jummah: EMPTY_TIME },
  updatedAt: null,
};

export type ReminderSound = 'iqra' | 'chime' | 'azan' | 'default';

export type QuranReminder = {
  enabled: boolean;
  time: string; // 24-hour "HH:MM", every day
  sound: ReminderSound;
};

export type Language = 'en' | 'ta';
export type CustomAzan = { uri: string; name: string };

export type Settings = {
  language: Language; // app text, and the Quran / hadith translation shown
  afterMinutes: number; // Namaz starts this long after the Azan (when no Jamaat time), for DND
  method: CalcMethod;
  madhab: AsrMadhab;
  playAzan: boolean;
  azanLength: 'full' | 'short'; // full recording, or the first ~20 s
  fajrWake: boolean; // one wake-up alarm 10 min before Fajr, then the Fajr Azan
  dnd: boolean; // Do Not Disturb during Namaz (Android, needs DND access)
  dndMinutes: number; // how long DND stays on, from the "Namaz due" reminder
  masjid: Masjid; // her masjid's own Azan/Jamaat times (from the board)
  quranReminder: QuranReminder;
  customAzan: { full: CustomAzan | null; short: CustomAzan | null }; // recordings picked from the phone
};

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  afterMinutes: 15,
  method: 'Karachi',
  madhab: 'Hanafi',
  playAzan: true,
  azanLength: 'full',
  fajrWake: true,
  dnd: false,
  dndMinutes: 20,
  masjid: EMPTY_MASJID,
  quranReminder: { enabled: false, time: '20:00', sound: 'iqra' },
  customAzan: { full: null, short: null },
};

const KEY = 'settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
