import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { reminderForToday } from '@/constants/content';
import { notifyFor } from '@/constants/messages';

import { makeT } from './i18n';

import { dueTime, formatTime, getUpcoming, type Coords } from './prayer';
import type { Settings } from './settings';

// Android channel settings are fixed once created, so bump the id if the sound changes.
const CHANNEL_REMINDER = 'prayer-reminder';
// Fajr is a wake-up alarm: its own Azan, played on the alarm stream so it sounds in silent mode and DND.
// Full and short Azans need separate channels, since a channel's sound can't change once created.
const AZAN = {
  full: { channel: 'azan-v3', sound: 'azan.wav' },
  short: { channel: 'azan-short-v3', sound: 'azan_short.wav' },
} as const;
// Daily Quran reading reminder — one channel per sound.
const QURAN_REMINDER = {
  iqra: { channel: 'quran-reminder-iqra', sound: 'reminder_iqra.wav', name: 'Quran reminder (Iqra)' },
  chime: { channel: 'quran-reminder-chime', sound: 'reminder_chime.wav', name: 'Quran reminder (chime)' },
  azan: { channel: 'quran-reminder-azan-v2', sound: 'azan_short.wav', name: 'Quran reminder (short Azan)' },
  default: { channel: 'quran-reminder-default', sound: 'default', name: 'Quran reminder' },
} as const;

const FAJR = {
  full: { channel: 'azan-fajr-v2', sound: 'azan_fajr.wav' },
  short: { channel: 'azan-fajr-short-v2', sound: 'azan_fajr_short.wav' },
} as const;

// Fajr wake-up alarms before the Azan, on the alarm stream (rings in silent mode and DND).
const FAJR_WAKE = { channel: 'fajr-wake-v3', sound: 'fajr_wake.wav' } as const;
export const FAJR_WAKE_MINUTES = [10];

// 3 notifications per prayer x 5 prayers = 15 a day. Rescheduled every time the app opens.
const DAYS_AHEAD = 5;

export type NotificationKind = 'wake' | 'azan' | 'due' | 'quran' | 'note';

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    // Only while the app is on screen does it play the Azan itself; with the screen off or the app in the
    // background, the notification's own sound plays it (Android keeps that going, unlike app audio).
    const appPlaysAzan = n.request.content.data?.kind === 'azan' && AppState.currentState === 'active';
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !appPlaysAzan,
      shouldSetBadge: false,
    };
  },
});

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_REMINDER, {
    name: 'Prayer reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
  for (const [length, { channel, sound }] of Object.entries(AZAN)) {
    await Notifications.setNotificationChannelAsync(channel, {
      name: length === 'full' ? 'Azan' : 'Azan (short)',
      importance: Notifications.AndroidImportance.MAX,
      sound,
      bypassDnd: true,
      audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  for (const { channel, sound, name } of Object.values(QURAN_REMINDER)) {
    await Notifications.setNotificationChannelAsync(channel, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
      ...(sound === 'default' ? {} : { sound }),
    });
  }
  for (const [length, { channel, sound }] of Object.entries(FAJR)) {
    await Notifications.setNotificationChannelAsync(channel, {
      name: length === 'full' ? 'Fajr wake-up Azan' : 'Fajr wake-up Azan (short)',
      importance: Notifications.AndroidImportance.MAX,
      sound,
      bypassDnd: true,
      audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.deleteNotificationChannelAsync('fajr-wake-v1'); // old Iqra sound
  await Notifications.deleteNotificationChannelAsync('fajr-wake-v2'); // old alarm, 6 times over
  await Notifications.deleteNotificationChannelAsync('azan-fajr-v1'); // old Fajr Azan recording
  await Notifications.deleteNotificationChannelAsync('azan-fajr-short-v1');
  await Notifications.deleteNotificationChannelAsync('azan-v2'); // was silent on silent/vibrate and in DND
  await Notifications.deleteNotificationChannelAsync('azan-short-v2');
  await Notifications.deleteNotificationChannelAsync('azan-v1'); // old Azan recordings (now the same as Fajr's)
  await Notifications.deleteNotificationChannelAsync('azan-short-v1');
  await Notifications.deleteNotificationChannelAsync('quran-reminder-azan');
  await Notifications.setNotificationChannelAsync(FAJR_WAKE.channel, {
    name: 'Fajr wake-up alarm',
    importance: Notifications.AndroidImportance.MAX,
    sound: FAJR_WAKE.sound,
    bypassDnd: true,
    audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannels(); // Android 13+ only shows the prompt after a channel exists
  const { granted } = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    try {
      const exact = await Notifications.getExactAlarmPermissionsAsync();
      if (!exact.granted) await Notifications.requestExactAlarmPermissionsAsync();
    } catch {
      // Without exact alarms Android delivers at an approximate time; still usable.
    }
  }
  return granted;
}

export async function schedulePrayerNotifications(coords: Coords, settings: Settings) {
  await ensureChannels();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  const jobs: Promise<string>[] = [];

  const add = (
    kind: NotificationKind,
    date: Date,
    title: string,
    body: string,
    channelId: string,
    sound = 'default',
    extra: Record<string, string | number> = {},
  ) => {
    if (date.getTime() <= now) return;
    jobs.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { kind, prayer: title.split(' ')[0], ...extra },
          sound,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
      }),
    );
  };

  const NOTIFY = notifyFor(settings.language);
  const t = makeT(settings.language);
  for (const p of getUpcoming(coords, settings, DAYS_AHEAD)) {
    const { name: prayer, time, jamaat } = p;
    const name = t(prayer); // shown in her language; `prayer` (English) goes in the data
    const tag = { prayer };
    const due = dueTime(p, settings);

    if (prayer === 'Fajr' && settings.fajrWake) {
      // One wake-up alarm before Fajr (it plays the wake sound 3 times over), then the Fajr Azan.
      for (const m of FAJR_WAKE_MINUTES) {
        const at = new Date(time.getTime() - m * 60_000);
        add('wake', at, NOTIFY.wakeTitle(m), NOTIFY.wakeBody, FAJR_WAKE.channel, FAJR_WAKE.sound, { ...tag, fajrAt: time.getTime() });
      }
    }
    if (!settings.playAzan) {
      add('azan', time, NOTIFY.azanTitle(name), NOTIFY.azanBody(name, formatTime(time)), CHANNEL_REMINDER, 'default', tag);
    } else if (prayer === 'Fajr') {
      const { channel, sound } = FAJR[settings.azanLength];
      add('azan', time, NOTIFY.azanTitle(name), NOTIFY.fajrBody(formatTime(time)), channel, sound, tag);
    } else {
      const { channel, sound } = AZAN[settings.azanLength];
      add('azan', time, NOTIFY.azanTitle(name), NOTIFY.azanBody(name, formatTime(time)), channel, sound, tag);
    }
    if (prayer === 'Fajr') {
      // The day's reminder, after Fajr namaz (and after the DND window, so it isn't silenced).
      const at = new Date(due.getTime() + ((settings.dnd ? settings.dndMinutes : 0) + 10) * 60_000);
      add('note', at, NOTIFY.noteTitle, reminderForToday(settings.language, at), CHANNEL_REMINDER);
    }
    // One notification per prayer (the Azan); a second only when the Jamaat is later than the Azan.
    if (jamaat && jamaat.getTime() !== time.getTime()) add('due', due, NOTIFY.dueTitle(name), NOTIFY.jamaatBody(name, formatTime(jamaat)), CHANNEL_REMINDER, 'default', tag);
  }

  // Daily Quran reading reminder; tapping it opens the Quran tab.
  const reminder = settings.quranReminder;
  if (reminder.enabled) {
    const [hour, minute] = reminder.time.split(':').map(Number);
    const { channel, sound } = QURAN_REMINDER[reminder.sound];
    jobs.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: NOTIFY.quranTitle,
          body: NOTIFY.quranBody,
          data: { kind: 'quran', url: '/quran' },
          sound,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: channel },
      }),
    );
  }

  await Promise.all(jobs);
  return jobs.length;
}

/** She's awake: cancel the remaining wake-up alarms for that Fajr (the Azan still plays). */
export async function cancelFajrWake(fajrAt: number) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'wake' && n.content.data?.fajrAt === fajrAt)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
