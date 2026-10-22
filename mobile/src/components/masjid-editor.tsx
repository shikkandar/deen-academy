import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { pickBoardPhoto, scanBoard } from '@/lib/masjid-scan';
import type { Masjid, MasjidPrayer, MasjidTime } from '@/lib/settings';

import { JasmineFlower } from './jasmine-flower';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const ROWS: { key: MasjidPrayer; label: string }[] = [
  { key: 'fajr', label: 'Fajr' },
  { key: 'dhuhr', label: 'Dhuhr' },
  { key: 'asr', label: 'Asr' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isha', label: 'Isha' },
  { key: 'jummah', label: 'Jummah' },
];

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function toHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** One editable time. Tap opens the Android clock; long-press clears it. Plain text field elsewhere (web preview). */
function TimeChip({ value, onChange, highlight }: { value: string | null; onChange: (v: string | null) => void; highlight: boolean }) {
  const theme = useTheme();
  const t = useT();
  const chipStyle = [
    styles.chip,
    { borderColor: highlight ? theme.primary : theme.border, backgroundColor: value ? theme.primarySoft : theme.background },
  ];

  if (Platform.OS !== 'android') {
    return (
      <TextInput
        value={value ?? ''}
        placeholder="HH:MM"
        placeholderTextColor={theme.textSecondary}
        onChangeText={(t) => onChange(/^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : t === '' ? null : value)}
        style={[chipStyle, styles.chipInput, { color: theme.text }]}
      />
    );
  }

  const open = () => {
    const [h, m] = (value ?? '12:00').split(':').map(Number);
    DateTimePickerAndroid.open({
      value: new Date(2000, 0, 1, h, m),
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(toHHMM(date));
      },
    });
  };

  return (
    <SpringPressable onPress={open} onLongPress={() => onChange(null)} pressedScale={0.94} style={chipStyle}>
      <ThemedText style={[styles.chipText, { color: value ? theme.primary : theme.textSecondary }]}>
        {value ? to12h(value) : t('Set')}
      </ThemedText>
    </SpringPressable>
  );
}

/** Mounted only while open, so the draft always starts from the saved values. */
type Props = {
  masjid: Masjid;
  onClose: () => void;
  onSave: (m: Masjid) => void;
};

export function MasjidEditor({ masjid, onClose, onSave }: Props) {
  const theme = useTheme();
  const t = useT();
  const [draft, setDraft] = useState(masjid);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [scanned, setScanned] = useState<Set<string>>(new Set());

  const setTime = (key: MasjidPrayer, field: keyof MasjidTime, v: string | null) =>
    setDraft((d) => ({ ...d, times: { ...d.times, [key]: { ...d.times[key], [field]: v } } }));

  const scan = async (source: 'camera' | 'gallery') => {
    setMessage(null);
    try {
      const photo = await pickBoardPhoto(source);
      if (!photo) return;
      setScanning(true);
      const result = await scanBoard(photo);
      const filled = new Set<string>();
      setDraft((d) => {
        const times = { ...d.times };
        for (const { key } of ROWS) {
          const t = result.times[key];
          // Only overwrite what the board actually shows; keep her manual entries otherwise.
          times[key] = { azan: t.azan ?? d.times[key].azan, jamaat: t.jamaat ?? d.times[key].jamaat };
          if (t.azan) filled.add(`${key}.azan`);
          if (t.jamaat) filled.add(`${key}.jamaat`);
        }
        return { ...d, name: d.name || result.name || '', times };
      });
      setScanned(filled);
      setMessage({
        text: `${t('Read {n} times from the board — please check them.', { n: filled.size })}${result.notes ? ` ${result.notes}` : ''}`,
        error: false,
      });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : t('Scan failed, please try again.'), error: true });
    } finally {
      setScanning(false);
    }
  };

  const hasAnyTime = ROWS.some(({ key }) => draft.times[key].azan || draft.times[key].jamaat);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.header}>
              <View style={styles.flex}>
                <ThemedText style={styles.title}>{t('My Masjid')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t("Times from your masjid's board. Reminders and DND follow the Jamaat time.")}
                </ThemedText>
              </View>
              <JasmineFlower size={34} rotate={15} />
            </Animated.View>

            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder={t('Masjid name')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.nameInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
            />

            {/* Scan */}
            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardTitle}>
                {t('SCAN THE TIMING BOARD')}
              </ThemedText>
              <View style={styles.scanRow}>
                <SpringPressable
                  disabled={scanning}
                  onPress={() => scan('camera')}
                  style={[styles.scanBtn, { backgroundColor: theme.primary, opacity: scanning ? 0.6 : 1 }]}>
                  <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('Take photo')}</ThemedText>
                </SpringPressable>
                <SpringPressable
                  disabled={scanning}
                  onPress={() => scan('gallery')}
                  style={[styles.scanBtn, { backgroundColor: theme.primarySoft, opacity: scanning ? 0.6 : 1 }]}>
                  <ThemedText style={[styles.bold, { color: theme.primary }]}>{t('From gallery')}</ThemedText>
                </SpringPressable>
              </View>
              {scanning && (
                <Animated.View entering={FadeIn} style={styles.scanning}>
                  <ActivityIndicator color={theme.primary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Reading the board…')}
                  </ThemedText>
                </Animated.View>
              )}
              {message && !scanning && (
                <Animated.View entering={FadeIn}>
                  <ThemedText type="small" style={[styles.message, { color: message.error ? '#C2410C' : theme.primary }]}>
                    {message.text}
                  </ThemedText>
                </Animated.View>
              )}
            </View>

            {/* Edit */}
            <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.tableHead}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.cardTitle, styles.flex]}>
                  {t('TIMES')}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colHead}>
                  {t('AZAN')}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.colHead}>
                  {t('JAMAAT')}
                </ThemedText>
              </View>
              {ROWS.map(({ key, label }, i) => (
                <View
                  key={key}
                  style={[styles.row, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <ThemedText style={styles.flex}>{t(label)}</ThemedText>
                  <TimeChip value={draft.times[key].azan} highlight={scanned.has(`${key}.azan`)} onChange={(v) => setTime(key, 'azan', v)} />
                  <TimeChip
                    value={draft.times[key].jamaat}
                    highlight={scanned.has(`${key}.jamaat`)}
                    onChange={(v) => setTime(key, 'jamaat', v)}
                  />
                </View>
              ))}
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {t('Tap a time to change it · long-press to clear. Empty Azan uses the calculated time.')}
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <SpringPressable
                onPress={onClose}
                style={[styles.pill, { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 }]}>
                <ThemedText style={[styles.bold, { color: theme.primary }]}>{t('Cancel')}</ThemedText>
              </SpringPressable>
              <SpringPressable
                disabled={scanning}
                onPress={() => onSave({ ...draft, enabled: draft.enabled || hasAnyTime, updatedAt: Date.now() })}
                style={[styles.pill, styles.flex, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('Save times')}</ThemedText>
              </SpringPressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  scroll: { padding: Spacing.three + Spacing.one, gap: Spacing.three, paddingBottom: Spacing.six },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  title: { fontFamily: Fonts?.serif, fontSize: 30, lineHeight: 38, fontWeight: 600 },
  nameInput: { borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  cardTitle: { letterSpacing: 1.5 },
  scanRow: { flexDirection: 'row', gap: Spacing.two },
  scanBtn: { flex: 1, borderRadius: 999, paddingVertical: Spacing.three, alignItems: 'center' },
  scanning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.one },
  message: { paddingTop: Spacing.one },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  colHead: { width: 92, textAlign: 'center', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  chip: { width: 92, borderRadius: 12, borderWidth: 1, paddingVertical: Spacing.two, alignItems: 'center' },
  chipInput: { textAlign: 'center', fontSize: 15 },
  chipText: { fontWeight: 600, fontVariant: ['tabular-nums'] },
  hint: { paddingTop: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two },
  pill: { borderRadius: 999, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, alignItems: 'center' },
});
