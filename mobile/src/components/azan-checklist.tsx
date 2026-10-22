import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { requestNotificationPermission } from '@/lib/notifications';

import {
  canScheduleExactAlarms,
  isDndSupported,
  isIgnoringBatteryOptimizations,
  openExactAlarmSettings,
  requestIgnoreBatteryOptimizations,
} from '../../modules/prayer-dnd';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

type Check = { id: string; label: string; why: string; ok: boolean; fix: () => void };

/**
 * Everything Android needs for the Azan to ring on time, with a Fix button for each one that's missing.
 * Re-checked whenever the app comes back from system settings.
 */
export function AzanChecklist() {
  const theme = useTheme();
  const t = useT();
  const { dndAccess, openDndSettings } = useAppState();
  const [state, setState] = useState({ notifications: true, exact: true, battery: true });

  const refresh = useCallback(async () => {
    const { granted } = await Notifications.getPermissionsAsync().catch(() => ({ granted: true }));
    setState({ notifications: granted, exact: canScheduleExactAlarms(), battery: isIgnoringBatteryOptimizations() });
  }, []);

  useEffect(() => {
    // async: the first check lands after the first render
    Promise.resolve().then(refresh);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (Platform.OS !== 'android' || !isDndSupported) return null;

  const checks: Check[] = [
    {
      id: 'notifications',
      label: t('Notifications allowed'),
      why: t('Without it no Azan or reminder can show.'),
      ok: state.notifications,
      fix: () => requestNotificationPermission().then(refresh),
    },
    {
      id: 'exact',
      label: t('Alarms & reminders allowed'),
      why: t('So the Azan rings at the exact minute, not “around” it.'),
      ok: state.exact,
      fix: openExactAlarmSettings,
    },
    {
      id: 'battery',
      label: t('Battery: unrestricted'),
      why: t('Battery saving makes many phones delay or skip the Fajr Azan.'),
      ok: state.battery,
      fix: requestIgnoreBatteryOptimizations,
    },
    {
      id: 'dnd',
      label: t('Do Not Disturb access'),
      why: t('Silences calls and messages during namaz and the Namaz Assistant.'),
      ok: dndAccess,
      fix: openDndSettings,
    },
  ];
  const missing = checks.filter((c) => !c.ok).length;

  return (
    <View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        {missing === 0
          ? t('All set. The Azan will ring on time, even with the app closed.')
          : t(missing > 1 ? '{n} things to fix so the Azan never misses.' : '{n} thing to fix so the Azan never misses.', { n: missing })}
      </ThemedText>
      {checks.map((c, i) => (
        <View key={c.id} style={[styles.row, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.text}>
            <ThemedText style={styles.bold}>
              {c.ok ? '✓ ' : '⚠ '}
              {c.label}
            </ThemedText>
            {!c.ok && (
              <ThemedText type="small" themeColor="textSecondary">
                {c.why}
              </ThemedText>
            )}
          </View>
          {!c.ok && (
            <SpringPressable onPress={c.fix} style={[styles.fix, { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={[styles.bold, { color: theme.onPrimary }]}>
                {t('Fix')}
              </ThemedText>
            </SpringPressable>
          )}
        </View>
      ))}
      <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
        {t('Vivo, Oppo, Xiaomi, Realme: also turn on “Autostart” for this app in the phone’s settings.')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  text: { flex: 1, gap: Spacing.half },
  bold: { fontWeight: 700 },
  fix: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
