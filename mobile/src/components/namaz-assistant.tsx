import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { playExclusive, setPlaybackRate, type LockScreen } from '@/lib/audio-focus';
import type { T } from '@/lib/i18n';
import type { PrayerName } from '@/lib/prayer';
import { RECITERS } from '@/lib/quran';
import { rakatFor, type Rakat } from '@/lib/rakat';
import { endPrayerSession, isDndSupported, startPrayerSession } from '../../modules/prayer-dnd';
import { buildSalah, flatten, LENGTHS, type Length, type Salah, type Speed } from '@/lib/salah-sequence';

import { JasmineFlower } from './jasmine-flower';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const SPEEDS: Speed[] = [1, 1.5, 2];
const PRAYER_CHOICES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const LENGTH_LABEL: Record<Length, string> = { short: 'Short', medium: 'Medium', long: 'Long' };
const POSTURE: Record<string, string> = {
  standing: 'Standing (Qiyam)',
  ruku: 'Bowing (Ruku)',
  sujood: 'Prostration (Sajdah)',
  sitting: 'Sitting (Qa‘dah)',
  dua: 'After the Salam',
};

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <SpringPressable
      pressedScale={0.95}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? theme.primary : theme.primarySoft }]}>
      <ThemedText type="small" style={[styles.bold, { color: on ? theme.onPrimary : theme.primary }]}>
        {label}
      </ThemedText>
    </SpringPressable>
  );
}

// Transliterations that are really English phrases, so they are translated too.
const TRANSLATED_TRANSLITERATION = new Set(['dua-gap', 'jamaat']);

function partLabel(p: Rakat, t: T) {
  return `${p.count} ${t(p.kind)}${p.optional ? ` (${t('optional')})` : ''}`;
}

function salahTitle(s: Salah, t: T) {
  return t('{prayer} {kind} · {n} Rakat', { prayer: t(s.prayer), kind: t(s.kind), n: s.rakats });
}

/**
 * Leads one whole prayer aloud like an imam, then 2 quiet minutes for dua and the Jamaat dua (after the Fard),
 * then offers the Sunnah of the same prayer.
 */
export function NamazAssistant({
  prayer: suggested,
  visible,
  onClose,
}: {
  prayer: PrayerName;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  // The prayer whose time is running, unless another is picked (a missed one to make up).
  const [picked, setPicked] = useState<PrayerName | null>(null);
  const prayer = picked ?? suggested;
  const { wide } = useLayout();
  const t = useT();
  const { settings, dndAccess, openDndSettings } = useAppState();
  const parts = useMemo(() => rakatFor(prayer, settings.madhab).parts, [prayer, settings.madhab]);
  const fardIndex = Math.max(0, parts.findIndex((p) => p.kind === 'Fard'));

  const [partIndex, setPartIndex] = useState(fardIndex);
  const [length, setLength] = useState<Length>('short');
  const [speed, setSpeed] = useState<Speed>(1);
  const [reciter, setReciter] = useState<string>('ar.alafasy');
  const [salah, setSalah] = useState<Salah | null>(null);
  const [finished, setFinished] = useState(false);
  const [donePart, setDonePart] = useState<number | null>(null);

  const playlist = useAudioPlaylist();
  const status = useAudioPlaylistStatus(playlist);
  const flat = useMemo(() => (salah ? flatten(salah) : null), [salah]);
  const stepIndex = flat ? (flat.stepOf[status.currentIndex] ?? 0) : 0;
  const step = salah?.steps[stepIndex];

  const lock = (title: string): LockScreen => ({
    metadata: { title, artist: t('Namaz Assistant'), albumTitle: 'Deen Academy' },
    options: { showNextTrack: true, showPreviousTrack: true },
  });

  const start = (index: number) => {
    const part = parts[index];
    const next = buildSalah({
      prayer,
      kind: part.kind,
      rakats: part.count,
      madhab: settings.madhab,
      length,
      speed,
      reciter,
      withDua: part.kind === 'Fard',
    });
    const { tracks } = flatten(next);
    playlist.pause();
    playlist.clear();
    for (const t of tracks) playlist.add(t);
    setPlaybackRate(playlist, speed);
    setSalah(next);
    setPartIndex(index);
    setFinished(false);
    setDonePart(null);
    playlist.skipTo(0);
    // No calls, messages or notifications until the prayer is over.
    startPrayerSession();
    playExclusive(playlist, lock(salahTitle(next, t)));
  };

  // The whole prayer finished: show what's next.
  useEffect(() => {
    const sub = playlist.addListener('playlistStatusUpdate', (s) => {
      if (s.didJustFinish && s.currentIndex >= s.trackCount - 1) {
        endPrayerSession();
        setFinished(true);
        setDonePart((d) => d ?? partIndex);
      }
    });
    return () => sub.remove();
  }, [playlist, partIndex]);

  // Keep the speed and the lock-screen title in step with the playlist.
  useEffect(() => {
    if (salah) setPlaybackRate(playlist, speed);
  }, [playlist, salah, speed, status.currentIndex]);
  useEffect(() => {
    if (salah && step) {
      playlist.updateLockScreenMetadata({
        title: step.rakat
          ? t('Rakat {n} · {title}', { n: step.rakat, title: t(step.title, step.vars) })
          : t(step.title, step.vars),
        artist: salahTitle(salah, t),
        albumTitle: t('Namaz Assistant'),
      });
    }
  }, [playlist, salah, step, t]);

  const choosePrayer = (p: PrayerName) => {
    setPicked(p === suggested ? null : p);
    setPartIndex(Math.max(0, rakatFor(p, settings.madhab).parts.findIndex((r) => r.kind === 'Fard')));
  };

  const close = () => {
    playlist.pause();
    endPrayerSession();
    setSalah(null);
    setFinished(false);
    setPicked(null);
    setPartIndex(Math.max(0, rakatFor(suggested, settings.madhab).parts.findIndex((r) => r.kind === 'Fard')));
    onClose();
  };

  const goStep = (delta: number) => {
    if (!flat) return;
    const target = Math.min(Math.max(stepIndex + delta, 0), (salah?.steps.length ?? 1) - 1);
    const track = flat.stepOf.indexOf(target);
    if (track >= 0) {
      playlist.skipTo(track);
      playExclusive(playlist, lock(salahTitle(salah!, t)));
    }
  };

  const sunnahAfter = parts
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.kind !== 'Fard' && i !== donePart);
  const gapLeft = step?.key === 'dua-gap' ? Math.max(0, Math.ceil((step.seconds - status.currentTime) / speed)) : null;
  const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <ThemedView style={styles.container}>
        {/* Desktop: a centred column rather than a full-width page. */}
        <SafeAreaView style={[styles.safeArea, wide && styles.safeAreaWide]}>
          <View style={styles.topBar}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {t('NAMAZ ASSISTANT · {prayer}', { prayer: t(prayer).toUpperCase() })}
            </ThemedText>
            <SpringPressable onPress={close} style={[styles.chip, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                {t('Close')}
              </ThemedText>
            </SpringPressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {!salah && (
              <Animated.View entering={FadeIn} style={styles.block}>
                <ThemedText style={styles.heading}>{t('Pray {prayer} with an imam', { prayer: t(prayer) })}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(
                    'Every takbir, the recitation, ruku and sajdah, Attahiyat, Salawat and Salam, aloud in Arabic. After the Fard: 2 quiet minutes for your dua, then the Jamaat dua.',
                  )}
                </ThemedText>

                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  {t('WHICH NAMAZ')}
                </ThemedText>
                <View style={styles.row}>
                  {PRAYER_CHOICES.map((c) => (c === 'Dhuhr' && suggested === 'Jummah' ? 'Jummah' : c)).map((p) => (
                    <Chip key={p} on={prayer === p} label={t(p)} onPress={() => choosePrayer(p)} />
                  ))}
                </View>

                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  {t('PRAYER')}
                </ThemedText>
                <View style={styles.row}>
                  {parts.map((p, i) => (
                    <Chip key={i} on={partIndex === i} label={partLabel(p, t)} onPress={() => setPartIndex(i)} />
                  ))}
                </View>

                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  {t('EACH RAKAT')}
                </ThemedText>
                <View style={styles.row}>
                  {(Object.keys(LENGTHS) as Length[]).map((l) => (
                    <Chip
                      key={l}
                      on={length === l}
                      label={t('{label} · {from}–{to} min', { label: t(LENGTH_LABEL[l]), from: LENGTHS[l][0] / 60, to: LENGTHS[l][1] / 60 })}
                      onPress={() => setLength(l)}
                    />
                  ))}
                </View>

                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  {t('SPEED')}
                </ThemedText>
                <View style={styles.row}>
                  {SPEEDS.map((s) => (
                    <Chip key={s} on={speed === s} label={`${s}x`} onPress={() => setSpeed(s)} />
                  ))}
                </View>

                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  {t('RECITER')}
                </ThemedText>
                <View style={styles.row}>
                  {RECITERS.slice(0, 4).map((r) => (
                    <Chip key={r.id} on={reciter === r.id} label={r.name} onPress={() => setReciter(r.id)} />
                  ))}
                </View>

                {isDndSupported && !dndAccess && (
                  <SpringPressable onPress={openDndSettings} style={[styles.notice, { backgroundColor: theme.primarySoft }]}>
                    <ThemedText type="small" style={{ color: theme.primary }}>
                      {t('Allow “Do Not Disturb” access so calls and messages don’t interrupt your namaz →')}
                    </ThemedText>
                  </SpringPressable>
                )}
                {isDndSupported && dndAccess && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('🔕 Calls, messages and notifications stay silent until the Salam.')}
                  </ThemedText>
                )}

                <SpringPressable onPress={() => start(partIndex)} style={[styles.start, { backgroundColor: theme.primary }]}>
                  <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('▶  Start {part}', { part: partLabel(parts[partIndex], t) })}</ThemedText>
                </SpringPressable>
              </Animated.View>
            )}

            {salah && step && !finished && (
              <Animated.View entering={FadeIn} style={styles.block}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {salahTitle(salah, t)}
                </ThemedText>
                <View style={[styles.hero, { backgroundColor: theme.hero }]}>
                  <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.8 }}>
                    {step.rakat
                      ? t('Rakat {n} of {total} · {posture}', { n: step.rakat, total: salah.rakats, posture: t(POSTURE[step.posture]) })
                      : t(POSTURE[step.posture])}
                  </ThemedText>
                  <ThemedText style={[styles.stepTitle, { color: theme.onPrimary }]}>{t(step.title, step.vars)}</ThemedText>
                  {gapLeft != null && (
                    <ThemedText style={[styles.countdown, { color: theme.onPrimary }]}>{minutes(gapLeft)}</ThemedText>
                  )}
                </View>

                <ThemedText style={styles.arabic}>{step.arabic}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {TRANSLATED_TRANSLITERATION.has(step.key) ? t(step.transliteration) : step.transliteration}
                </ThemedText>
                <ThemedText type="small" style={styles.center}>
                  {t(step.english, step.vars)}
                </ThemedText>

                <View style={styles.controls}>
                  <SpringPressable onPress={() => goStep(-1)} style={[styles.ctrl, { backgroundColor: theme.primarySoft }]}>
                    <ThemedText style={[styles.bold, { color: theme.primary }]}>◀◀</ThemedText>
                  </SpringPressable>
                  <SpringPressable
                    onPress={() => (status.playing ? playlist.pause() : playExclusive(playlist, lock(salahTitle(salah, t))))}
                    style={[styles.ctrlMain, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{status.playing ? '❚❚' : '▶'}</ThemedText>
                  </SpringPressable>
                  <SpringPressable onPress={() => goStep(1)} style={[styles.ctrl, { backgroundColor: theme.primarySoft }]}>
                    <ThemedText style={[styles.bold, { color: theme.primary }]}>▶▶</ThemedText>
                  </SpringPressable>
                </View>

                <View style={[styles.row, styles.centerRow]}>
                  {SPEEDS.map((s) => (
                    <Chip key={s} on={speed === s} label={`${s}x`} onPress={() => setSpeed(s)} />
                  ))}
                </View>
              </Animated.View>
            )}

            {salah && finished && (
              <Animated.View entering={FadeIn} style={[styles.block, styles.centerBlock]}>
                <JasmineFlower size={36} />
                <ThemedText style={styles.heading}>{t('Taqabbal Allahu minna wa minkum')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {t('May Allah accept it from us and from you. {title} is complete.', { title: salahTitle(salah, t) })}
                </ThemedText>
                {sunnahAfter.length > 0 && (
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                    {t('PRAY NEXT')}
                  </ThemedText>
                )}
                {sunnahAfter.map(({ p, i }) => (
                  <SpringPressable key={i} onPress={() => start(i)} style={[styles.start, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('▶  Play {part}', { part: partLabel(p, t) })}</ThemedText>
                  </SpringPressable>
                ))}
                <SpringPressable onPress={close} style={[styles.start, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText style={[styles.bold, { color: theme.primary }]}>{t('Done')}</ThemedText>
                </SpringPressable>
              </Animated.View>
            )}
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  safeAreaWide: { maxWidth: 720, paddingTop: Spacing.four },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three },
  scroll: { padding: Spacing.three, paddingBottom: Spacing.six },
  block: { gap: Spacing.three },
  centerBlock: { alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: 700, textAlign: 'center' },
  label: { letterSpacing: 1.5, marginTop: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  centerRow: { justifyContent: 'center' },
  chip: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  bold: { fontWeight: 700 },
  notice: { borderRadius: 16, padding: Spacing.three },
  start: { borderRadius: 999, paddingVertical: Spacing.three, alignItems: 'center', alignSelf: 'stretch', marginTop: Spacing.two },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.one },
  stepTitle: { fontSize: 24, fontWeight: 700, textAlign: 'center' },
  countdown: { fontSize: 40, fontWeight: 700, fontVariant: ['tabular-nums'] },
  arabic: { fontSize: 28, lineHeight: 52, textAlign: 'center', writingDirection: 'rtl' },
  center: { textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.four, marginTop: Spacing.two },
  ctrl: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctrlMain: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
