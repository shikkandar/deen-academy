import adhkarData from '@/assets/data/after-namaz-duas.json';
import jamaatData from '@/assets/data/jamaat-duas.json';
import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { playExclusive, type LockScreen } from '@/lib/audio-focus';
import type { PrayerTime } from '@/lib/prayer';

import { JasmineFlower } from './jasmine-flower';
import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

/** One dua as shown: a single Hisn al-Muslim dhikr, or one or more Quran ayahs (each its own audio track). */
type Item = {
  id: string;
  title: string;
  subtitle: string | null;
  arabic: string;
  transliteration: string | null;
  english: string;
  repeat: number;
  tracks: string[];
};

type Tab = 'jamaat' | 'adhkar';

// The duas made together after the Jamaat ("Rabbana atina…", closing with "Subhana rabbika…").
const JAMAAT: Item[] = jamaatData.duas.map((d) => ({
  id: d.id,
  title: d.title,
  // 25:74 — the dua for spouses and children — is his dua for the two of them.
  subtitle: `${d.ayahs[0].surah} ${d.ayahs.map((a) => a.ref).join(', ')}`,
  arabic: d.ayahs.map((a) => a.arabic).join(' ۝ '),
  transliteration: d.ayahs.map((a) => a.transliteration).join(' '),
  english: d.ayahs.map((a) => a.english).join(' '),
  repeat: 1,
  tracks: d.ayahs.map((a) => a.audio),
}));

/** Hisn al-Muslim adhkar for this prayer (the three Quls are 3× after Fajr and Maghrib). */
function adhkarFor(prayer: string): Item[] {
  const fajrOrMaghrib = prayer === 'Fajr' || prayer === 'Maghrib';
  return adhkarData.duas
    .filter((d) => !d.prayers || d.prayers.includes(prayer))
    .map((d) => ({
      id: String(d.id),
      title: d.title,
      subtitle: d.note,
      arabic: d.arabic,
      transliteration: d.transliteration,
      english: d.english,
      repeat: fajrOrMaghrib && d.repeatFajrMaghrib ? d.repeatFajrMaghrib : d.repeat,
      tracks: [d.audio],
    }));
}

/** Tap to count a dhikr; turns into a ✓ when the count is reached. */
function Counter({ target }: { target: number }) {
  const theme = useTheme();
  const [count, setCount] = useState(0);
  const done = count >= target;
  return (
    <SpringPressable
      pressedScale={0.88}
      onPress={() => setCount((c) => (c >= target ? 0 : c + 1))}
      style={[styles.counter, { backgroundColor: done ? theme.primary : theme.petalSoft }]}>
      <ThemedText type="small" style={[styles.bold, styles.tabular, { color: done ? theme.onPrimary : theme.primary }]}>
        {done ? '✓' : `${count}/${target}`}
      </ThemedText>
    </SpringPressable>
  );
}

function DuaRow({ item, active, playing, onPlay }: { item: Item; active: boolean; playing: boolean; onPlay: () => void }) {
  const theme = useTheme();
  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18)}
      style={[styles.dua, { borderColor: active ? theme.primary : theme.border }, active && { backgroundColor: theme.primarySoft }]}>
      <View style={styles.duaTop}>
        <View style={styles.duaTitle}>
          <ThemedText type="smallBold">{item.title}</ThemedText>
          {item.subtitle && (
            <ThemedText type="small" themeColor="textSecondary">
              {item.subtitle}
            </ThemedText>
          )}
        </View>
        {item.repeat > 1 && <Counter target={item.repeat} />}
        <SpringPressable
          pressedScale={0.9}
          onPress={onPlay}
          style={[styles.play, { backgroundColor: active ? theme.primary : theme.petalSoft }]}>
          <ThemedText style={[styles.playIcon, { color: active ? theme.onPrimary : theme.primary }]}>
            {active && playing ? '❚❚' : '▶'}
          </ThemedText>
        </SpringPressable>
      </View>
      <ThemedText style={styles.arabic}>{item.arabic}</ThemedText>
      {item.transliteration && (
        <ThemedText type="small" style={[styles.translit, { color: theme.primary }]}>
          {item.transliteration}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.english}>
        {item.english}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * After-namaz duas: the Jamaat dua (Quranic "Rabbana" duas) and the Hisn al-Muslim adhkar.
 * `highlight` = it's just after the namaz: shown open, at the top. Otherwise a compact card.
 */
export function AfterNamazDuas({ prayer, highlight }: { prayer: PrayerTime; highlight: boolean }) {
  const theme = useTheme();
  const t = useT();
  const [tab, setTab] = useState<Tab>('jamaat');
  const items = tab === 'jamaat' ? JAMAAT : adhkarFor(prayer.name);
  // Every track of every dua in order, so "Play all" runs through multi-ayah duas too.
  const queue = items.flatMap((item, i) => item.tracks.map((url) => ({ item: i, url })));

  const [open, setOpen] = useState(highlight);
  const [started, setStarted] = useState(false);
  // A native playlist holds the whole queue and buffers the next track itself, so each dua / ayah
  // starts cleanly instead of losing its first moment while it downloads.
  const playlist = useAudioPlaylist();
  const status = useAudioPlaylistStatus(playlist);
  const playing = status.playing;
  const activeItem = started ? (queue[status.currentIndex]?.item ?? null) : null;

  // Load this tab's tracks into the playlist (and again whenever the tab or prayer changes).
  const queueKey = queue.map((q) => q.url).join('|');
  useEffect(() => {
    playlist.pause();
    playlist.clear();
    for (const q of queue) playlist.add({ uri: q.url });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queueKey captures the queue's contents
  }, [playlist, queueKey]);

  // The last track finished: back to the idle state.
  useEffect(() => {
    const sub = playlist.addListener('playlistStatusUpdate', (s) => {
      if (s.didJustFinish && s.currentIndex >= s.trackCount - 1) setStarted(false);
    });
    return () => sub.remove();
  }, [playlist]);

  // Lock screen / notification controls, so the duas keep playing with the screen off.
  const lock: LockScreen = {
    metadata: { title: tab === 'jamaat' ? 'Jamaat dua' : `After ${prayer.name} adhkar`, artist: 'After-namaz duas', albumTitle: 'Deen Academy' },
    options: { showNextTrack: true, showPreviousTrack: true },
  };

  const playFrom = (p: number) => {
    setStarted(true);
    setOpen(true);
    playlist.skipTo(p);
    playExclusive(playlist, lock);
  };

  const toggleItem = (i: number) => {
    if (activeItem === i) {
      if (playing) playlist.pause();
      else playExclusive(playlist, lock);
    } else {
      playFrom(queue.findIndex((q) => q.item === i));
    }
  };

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    playlist.pause();
    setStarted(false);
    setTab(t);
  };


  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: highlight ? theme.primary : theme.border }]}>
      {/* Two separate targets: the title opens/closes the list, the pill plays. */}
      <View style={styles.header}>
        <SpringPressable pressedScale={0.98} onPress={() => setOpen((o) => !o)} style={styles.headerToggle}>
          <JasmineFlower size={18} />
          <View style={styles.headerText}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {highlight ? t('AFTER {name} NAMAZ', { name: t(prayer.name).toUpperCase() }) : t('AFTER-NAMAZ DUAS')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {open ? t('tap to close') : t('Jamaat dua · adhkar · tap to open')}
            </ThemedText>
          </View>
        </SpringPressable>
        <SpringPressable
          onPress={() => (started ? (playing ? playlist.pause() : playExclusive(playlist, lock)) : playFrom(0))}
          style={[styles.playAll, { backgroundColor: theme.primary }]}>
          <ThemedText type="small" style={[styles.bold, { color: theme.onPrimary }]}>
            {started && playing ? t('❚❚  Pause') : started ? t('▶  Resume') : t('▶  Play all')}
          </ThemedText>
        </SpringPressable>
      </View>

      {open && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)} style={styles.list}>
          <View style={[styles.tabs, { backgroundColor: theme.background }]}>
            {(
              [
                ['jamaat', 'Jamaat Dua'],
                ['adhkar', 'Adhkar'],
              ] as const
            ).map(([id, label]) => (
              <SpringPressable
                key={id}
                pressedScale={0.96}
                onPress={() => switchTab(id)}
                style={[styles.tab, tab === id && { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="small" style={[styles.bold, { color: tab === id ? theme.primary : theme.textSecondary }]}>
                  {t(label)}
                </ThemedText>
              </SpringPressable>
            ))}
          </View>

          {items.map((item, i) => (
            <DuaRow key={`${tab}-${item.id}`} item={item} active={activeItem === i} playing={playing} onPlay={() => toggleItem(i)} />
          ))}
          <ThemedText type="small" themeColor="textSecondary" style={styles.source}>
            {tab === 'jamaat'
              ? t('Quranic duas · recitation by Mishary Rashid Alafasy · say Ameen')
              : t('From Hisn al-Muslim (Fortress of the Muslim) · hisnmuslim.com')}
          </ThemedText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  tabular: { fontVariant: ['tabular-nums'] },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerText: { flex: 1, gap: 2 },
  label: { letterSpacing: 1.5 },
  playAll: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  list: { gap: Spacing.two },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: Spacing.one, gap: Spacing.one },
  tab: { flex: 1, borderRadius: 999, paddingVertical: Spacing.two, alignItems: 'center' },
  dua: { borderWidth: 1, borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  duaTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  duaTitle: { flex: 1, gap: 2 },
  counter: { minWidth: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 12, fontWeight: 800 },
  arabic: { fontSize: 22, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl' },
  translit: { fontStyle: 'italic', lineHeight: 20 },
  english: { lineHeight: 20 },
  source: { textAlign: 'center', paddingTop: Spacing.one },
});
