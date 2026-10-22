import { requireOptionalNativeModule } from 'expo';

type DndWindow = { start: number; end: number };

type PrayerDndNative = {
  hasAccess(): boolean;
  openAccessSettings(): void;
  schedule(windows: DndWindow[]): void;
  cancel(): void;
  startSession(): boolean;
  endSession(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
};

// Android only, and only in a real build (not Expo Go / web) — everything below is a no-op otherwise.
const native = requireOptionalNativeModule<PrayerDndNative>('PrayerDnd');

export const isDndSupported = native != null;

export function hasDndAccess(): boolean {
  return native?.hasAccess() ?? false;
}

export function openDndAccessSettings() {
  native?.openAccessSettings();
}

export function scheduleDndWindows(windows: DndWindow[]) {
  native?.schedule(windows);
}

export function cancelDnd() {
  native?.cancel();
}

/** Namaz Assistant: "Alarms only" while it leads a prayer (false if DND access isn't granted). */
export function startPrayerSession(): boolean {
  return native?.startSession() ?? false;
}

/** Give the phone back the DND mode it had before the prayer. */
export function endPrayerSession() {
  native?.endSession();
}

/** True when the app is left out of battery optimisation (or the platform doesn't have it). */
export function isIgnoringBatteryOptimizations(): boolean {
  return native?.isIgnoringBatteryOptimizations() ?? true;
}

export function requestIgnoreBatteryOptimizations() {
  native?.requestIgnoreBatteryOptimizations();
}

export function canScheduleExactAlarms(): boolean {
  return native?.canScheduleExactAlarms() ?? true;
}

export function openExactAlarmSettings() {
  native?.openExactAlarmSettings();
}
