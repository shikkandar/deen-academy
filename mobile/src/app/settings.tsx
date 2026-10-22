import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AzanChecklist } from '@/components/azan-checklist';
import { JasmineFlower } from '@/components/jasmine-flower';
import { MasjidEditor } from '@/components/masjid-editor';
import { WelcomeNote } from '@/components/welcome';
import { enter, FloatingFlower, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { playSource } from '@/lib/audio-focus';
import { deleteAzanFile, pickAzanFile, type AzanLength } from '@/lib/custom-azan';
import type { T } from '@/lib/i18n';
import type { AsrMadhab, CalcMethod, Language, Masjid, ReminderSound } from '@/lib/settings';

const REMINDER_SOUNDS: { id: ReminderSound; label: string; note: string; file: number | null }[] = [
  { id: 'iqra', label: 'Iqra (Al-Alaq 96:1)', note: '"Read!" — recited by Alafasy', file: require('@/assets/sounds/reminder_iqra.wav') },
  { id: 'chime', label: 'Gentle chime', note: 'Soft bell tone', file: require('@/assets/sounds/reminder_chime.wav') },
  { id: 'azan', label: 'Short Azan', note: 'First 20 seconds of the Azan', file: require('@/assets/sounds/azan_short.wav') },
  { id: 'default', label: 'Phone default', note: 'Your usual notification sound', file: null },
];

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Tap to pick a time (Android clock); a plain HH:MM field in the web preview. */
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  const style = [styles.timeChip, { backgroundColor: theme.primarySoft }];
  if (Platform.OS !== 'android') {
    return (
      <TextInput
        defaultValue={value}
        placeholder="HH:MM"
        placeholderTextColor={theme.textSecondary}
        onChangeText={(t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t) && onChange(t)}
        style={[style, styles.timeInput, { color: theme.primary }]}
      />
    );
  }
  const open = () => {
    const [h, m] = value.split(':').map(Number);
    DateTimePickerAndroid.open({
      value: new Date(2000, 0, 1, h, m),
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === 'set' && date)
          onChange(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
      },
    });
  };
  return (
    <SpringPressable onPress={open} pressedScale={0.94} style={style}>
      <ThemedText style={[styles.bold, { color: theme.primary }]}>{to12h(value)}</ThemedText>
    </SpringPressable>
  );
}

function updatedLabel(m: Masjid, t: T) {
  if (!m.updatedAt) return t('Not set up yet');
  const days = Math.floor((Date.now() - m.updatedAt) / 86_400_000);
  const when = days === 0 ? t('today') : days === 1 ? t('yesterday') : t('{n} days ago', { n: days });
  return t('{name} · updated {when}', { name: m.name || t('Your masjid'), when });
}

// Each language named in its own script, so it's findable whichever one is on.
const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
];

const METHODS: { value: CalcMethod; label: string }[] = [
  { value: 'Karachi', label: 'Karachi (India / Pakistan)' },
  { value: 'MuslimWorldLeague', label: 'Muslim World League' },
  { value: 'UmmAlQura', label: 'Umm al-Qura (Makkah)' },
  { value: 'Egyptian', label: 'Egyptian' },
  { value: 'Dubai', label: 'Dubai' },
  { value: 'NorthAmerica', label: 'ISNA (North America)' },
];


const MADHABS: { value: AsrMadhab; label: string }[] = [
  { value: 'Shafi', label: "Shafi'i" },
  { value: 'Hanafi', label: 'Hanafi' },
];

function Stepper({ value, onChange, step = 5, min = 0, max = 60 }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const theme = useTheme();
  const t = useT();
  const btn = [styles.stepBtn, { backgroundColor: theme.primarySoft }];
  return (
    <View style={styles.stepper}>
      <SpringPressable pressedScale={0.88} onPress={() => onChange(Math.max(min, value - step))} style={btn}>
        <ThemedText style={[styles.stepBtnText, { color: theme.primary }]}>−</ThemedText>
      </SpringPressable>
      <Animated.View key={value} entering={FadeIn.duration(250)}>
        <ThemedText style={styles.stepValue}>{t('{n} min', { n: value })}</ThemedText>
      </Animated.View>
      <SpringPressable pressedScale={0.88} onPress={() => onChange(Math.min(max, value + step))} style={btn}>
        <ThemedText style={[styles.stepBtnText, { color: theme.primary }]}>+</ThemedText>
      </SpringPressable>
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <SpringPressable pressedScale={0.98} onPress={onPress} style={[styles.option, selected && { backgroundColor: theme.primarySoft }]}>
      <ThemedText style={selected && [styles.bold, { color: theme.primary }]}>{label}</ThemedText>
      {selected && (
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <JasmineFlower size={18} petalColor={theme.primary} />
        </Animated.View>
      )}
    </SpringPressable>
  );
}

function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Animated.View entering={enter(index)} style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>{children}</View>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const t = useT();
  const { settings, updateSettings, dndSupported, dndAccess, openDndSettings } = useAppState();
  const [editingMasjid, setEditingMasjid] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const reminder = settings.quranReminder;
  const setReminder = (patch: Partial<typeof reminder>) => updateSettings({ quranReminder: { ...reminder, ...patch } });
  // Preview player for the reminder sounds.
  const preview = useAudioPlayer();
  const { playing: previewing } = useAudioPlayerStatus(preview);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const togglePreview = (id: ReminderSound, file: number | null) => {
    if (!file) return;
    if (previewing && previewId === id) {
      preview.pause();
      return;
    }
    setPreviewId(id);
    playSource(preview, file);
  };
  // Her own Azan recordings, picked from the phone (one for Full, one for Short).
  const chooseAzan = async (length: AzanLength) => {
    try {
      const picked = await pickAzanFile(length);
      if (!picked) return;
      const old = settings.customAzan[length];
      if (old) deleteAzanFile(old.uri);
      updateSettings({ customAzan: { ...settings.customAzan, [length]: picked } });
    } catch {
      // the picker was closed or the file couldn't be read; keep what was there
    }
  };
  const resetAzan = (length: AzanLength) => {
    const old = settings.customAzan[length];
    if (old) deleteAzanFile(old.uri);
    updateSettings({ customAzan: { ...settings.customAzan, [length]: null } });
  };
  const previewAzan = (length: AzanLength) => {
    const custom = settings.customAzan[length];
    if (!custom) return;
    if (previewing && previewId === `azan-${length}`) {
      preview.pause();
      return;
    }
    setPreviewId(`azan-${length}`);
    playSource(preview, { uri: custom.uri });
  };
  const masjidHasTimes = Object.values(settings.masjid.times).some((t) => t.azan || t.jamaat);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={enter(0)} style={styles.header}>
            <ThemedText style={styles.serifTitle}>{t('Settings')}</ThemedText>
            <FloatingFlower size={30} rotate={20} period={30} />
          </Animated.View>


          <Animated.View entering={enter(1)}>
            <SpringPressable
              pressedScale={0.98}
              onPress={() => setShowWelcome(true)}
              style={[styles.letterRow, { backgroundColor: theme.primarySoft }]}>
              <JasmineFlower size={22} />
              <View style={styles.rowLabel}>
                <ThemedText style={[styles.bold, { color: theme.primary }]}>{t('Welcome note')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Read it again any time')}
                </ThemedText>
              </View>
              <ThemedText style={[styles.bold, { color: theme.primary }]}>›</ThemedText>
            </SpringPressable>
          </Animated.View>

          <Section title={t('MAKE SURE THE AZAN RINGS')} index={1}>
            <AzanChecklist />
          </Section>

          <Section title={t('LANGUAGE')} index={1}>
            {LANGUAGES.map((l) => (
              <Option key={l.value} label={l.label} selected={settings.language === l.value} onPress={() => updateSettings({ language: l.value })} />
            ))}
          </Section>

          <Section title={t('MY MASJID')} index={1}>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <ThemedText>{t("Use my masjid's timings")}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {updatedLabel(settings.masjid, t)}
                </ThemedText>
              </View>
              <Switch
                value={settings.masjid.enabled && masjidHasTimes}
                onValueChange={(v) => (v && !masjidHasTimes ? setEditingMasjid(true) : updateSettings({ masjid: { ...settings.masjid, enabled: v } }))}
                trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
                thumbColor={theme.petal}
              />
            </View>
            <SpringPressable onPress={() => setEditingMasjid(true)} style={[styles.accessBtn, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                {masjidHasTimes ? t('Scan board again / edit times →') : t('Scan the masjid timing board →')}
              </ThemedText>
            </SpringPressable>
          </Section>

          <Section title={t('NOTIFICATIONS')} index={2}>
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>{t('Namaz starts after Azan')}</ThemedText>
              <Stepper value={settings.afterMinutes} min={5} onChange={(v) => updateSettings({ afterMinutes: v })} />
            </View>
            <View style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
              <ThemedText style={styles.rowLabel}>{t('Play Azan at prayer time')}</ThemedText>
              <Switch
                value={settings.playAzan}
                onValueChange={(v) => updateSettings({ playAzan: v })}
                trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
                thumbColor={theme.petal}
              />
            </View>
            {settings.playAzan && (
              <View style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
                <ThemedText style={styles.rowLabel}>{t('Azan length')}</ThemedText>
                <View style={[styles.segment, { backgroundColor: theme.background }]}>
                  {(
                    [
                      ['full', 'Full'],
                      ['short', 'Short'],
                    ] as const
                  ).map(([v, label]) => {
                    const on = settings.azanLength === v;
                    return (
                      <SpringPressable
                        key={v}
                        pressedScale={0.95}
                        onPress={() => updateSettings({ azanLength: v })}
                        style={[styles.segmentBtn, on && { backgroundColor: theme.primary }]}>
                        <ThemedText type="small" style={[styles.bold, { color: on ? theme.onPrimary : theme.textSecondary }]}>
                          {t(label)}
                        </ThemedText>
                      </SpringPressable>
                    );
                  })}
                </View>
              </View>
            )}
            {settings.playAzan &&
              (
                [
                  ['full', 'Full Azan'],
                  ['short', 'Short Azan'],
                ] as const
              ).map(([length, label]) => {
                const custom = settings.customAzan[length];
                const playingThis = previewing && previewId === `azan-${length}`;
                return (
                  <View key={length} style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
                    <View style={styles.rowLabel}>
                      <ThemedText>{t(label)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {custom ? custom.name : t('Built-in recording')}
                      </ThemedText>
                    </View>
                    {custom && (
                      <SpringPressable
                        pressedScale={0.9}
                        onPress={() => previewAzan(length)}
                        style={[styles.previewBtn, { backgroundColor: playingThis ? theme.primary : theme.petalSoft }]}>
                        <ThemedText style={[styles.previewIcon, { color: playingThis ? theme.onPrimary : theme.primary }]}>
                          {playingThis ? '❚❚' : '▶'}
                        </ThemedText>
                      </SpringPressable>
                    )}
                    <SpringPressable
                      pressedScale={0.94}
                      onPress={() => (custom ? resetAzan(length) : chooseAzan(length))}
                      style={[styles.timeChip, { backgroundColor: theme.primarySoft }]}>
                      <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                        {custom ? t('Reset') : t('Choose…')}
                      </ThemedText>
                    </SpringPressable>
                  </View>
                );
              })}
            <View style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
              <View style={styles.rowLabel}>
                <ThemedText>{t('Fajr wake-up alarm')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('10 min before Fajr, then the Azan')}
                </ThemedText>
              </View>
              <Switch
                value={settings.fajrWake}
                onValueChange={(v) => updateSettings({ fajrWake: v })}
                trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
                thumbColor={theme.petal}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {t('Choose any audio file on the phone for the Full or Short Azan. It plays when the app is open at Azan time; otherwise the notification rings the built-in Azan. Fajr alarms ring even in silent mode and Do Not Disturb. Press a volume button to stop the Azan.')}
            </ThemedText>
          </Section>

          <Section title={t('QURAN REMINDER')} index={3}>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <ThemedText>{t('Daily reminder to read')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Tap the reminder to open the Quran')}
                </ThemedText>
              </View>
              <Switch
                value={reminder.enabled}
                onValueChange={(v) => setReminder({ enabled: v })}
                trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
                thumbColor={theme.petal}
              />
            </View>
            {reminder.enabled && (
              <>
                <View style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
                  <ThemedText style={styles.rowLabel}>{t('Every day at')}</ThemedText>
                  <TimeField value={reminder.time} onChange={(time) => setReminder({ time })} />
                </View>
                <ThemedText type="smallBold" themeColor="textSecondary" style={[styles.soundTitle, styles.divider, { borderTopColor: theme.border }]}>
                  {t('SOUND')}
                </ThemedText>
                {REMINDER_SOUNDS.map((s) => {
                  const on = reminder.sound === s.id;
                  const playingThis = previewing && previewId === s.id;
                  return (
                    <SpringPressable
                      key={s.id}
                      pressedScale={0.98}
                      onPress={() => setReminder({ sound: s.id })}
                      style={[styles.option, on && { backgroundColor: theme.primarySoft }]}>
                      <View style={styles.rowLabel}>
                        <ThemedText style={on && [styles.bold, { color: theme.primary }]}>{t(s.label)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {t(s.note)}
                        </ThemedText>
                      </View>
                      {s.file && (
                        <SpringPressable
                          pressedScale={0.9}
                          onPress={() => togglePreview(s.id, s.file)}
                          style={[styles.previewBtn, { backgroundColor: playingThis ? theme.primary : theme.petalSoft }]}>
                          <ThemedText style={[styles.previewIcon, { color: playingThis ? theme.onPrimary : theme.primary }]}>
                            {playingThis ? '❚❚' : '▶'}
                          </ThemedText>
                        </SpringPressable>
                      )}
                    </SpringPressable>
                  );
                })}
              </>
            )}
          </Section>

          <Section title={t('SILENT DURING NAMAZ')} index={4}>
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <ThemedText>{t('Do Not Disturb')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Turns on when Namaz starts, turns off by itself')}
                </ThemedText>
              </View>
              <Switch
                value={settings.dnd && dndAccess}
                disabled={!dndSupported}
                onValueChange={(v) => {
                  if (v && !dndAccess) openDndSettings();
                  updateSettings({ dnd: v });
                }}
                trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
                thumbColor={theme.petal}
              />
            </View>
            {settings.dnd && dndAccess && (
              <View style={[styles.row, styles.divider, { borderTopColor: theme.border }]}>
                <ThemedText style={styles.rowLabel}>{t('Stay silent for')}</ThemedText>
                <Stepper value={settings.dndMinutes} min={10} max={60} onChange={(v) => updateSettings({ dndMinutes: v })} />
              </View>
            )}
            {!dndSupported ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
                {t('Available in the installed Android app (not in Expo Go or the browser).')}
              </ThemedText>
            ) : (
              settings.dnd &&
              !dndAccess && (
                <SpringPressable onPress={openDndSettings} style={[styles.accessBtn, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                    {t('Allow "Do Not Disturb access" for Deen Academy →')}
                  </ThemedText>
                </SpringPressable>
              )
            )}
          </Section>

          <Section title={t('CALCULATION METHOD')} index={5}>
            {METHODS.map((m) => (
              <Option key={m.value} label={t(m.label)} selected={settings.method === m.value} onPress={() => updateSettings({ method: m.value })} />
            ))}
          </Section>

          <Section title={t('MADHAB · ASR TIME & RAKAT')} index={6}>
            {MADHABS.map((m) => (
              <Option key={m.value} label={t(m.label)} selected={settings.madhab === m.value} onPress={() => updateSettings({ madhab: m.value })} />
            ))}
          </Section>

        </ScrollView>
      </SafeAreaView>
      <WelcomeNote visible={showWelcome} onClose={() => setShowWelcome(false)} />
      {editingMasjid && (
        <MasjidEditor
          masjid={settings.masjid}
          onClose={() => setEditingMasjid(false)}
          onSave={(masjid) => {
            updateSettings({ masjid });
            setEditingMasjid(false);
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  letterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: 20, padding: Spacing.three },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingTop: TopTabInset + Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  bold: { fontWeight: 700 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  serifTitle: { fontFamily: Fonts?.serif, fontSize: 34, lineHeight: 42, fontWeight: 600 },
  section: { gap: Spacing.two },
  sectionTitle: { letterSpacing: 1.5, paddingHorizontal: Spacing.two },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  rowLabel: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, lineHeight: 24, fontWeight: 700 },
  stepValue: { minWidth: 56, textAlign: 'center', fontVariant: ['tabular-nums'] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
  },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  segmentBtn: { borderRadius: 999, paddingVertical: Spacing.one + 2, paddingHorizontal: Spacing.three },
  timeChip: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, minWidth: 96, alignItems: 'center' },
  timeInput: { textAlign: 'center', fontSize: 15, fontWeight: 700 },
  soundTitle: { letterSpacing: 1.5, paddingHorizontal: Spacing.two, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  previewBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  previewIcon: { fontSize: 12, fontWeight: 800 },
  hint: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.two },
  accessBtn: { margin: Spacing.two, padding: Spacing.three, borderRadius: 16, alignItems: 'center' },
});
