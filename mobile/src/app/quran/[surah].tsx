import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge, JasmineFlower } from '@/components/jasmine-flower';
import { enter, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { playExclusive, type LockScreen } from '@/lib/audio-focus';
import { loadQuranProgress, saveQuranProgress } from '@/lib/reading-progress';
import {
  TAMIL_CREDIT,
  TAMIL_EDITION,
  VOICES,
  BISMILLAH,
  editionsFor,
  getSurah,
  getSurahAudio,
  getSurahList,
  hasBismillahHeader,
  loadAudioPrefs,
  RECITERS,
  saveAudioPrefs,
  type AudioPrefs,
  type Voice,
  type Surah,
  type SurahInfo,
} from '@/lib/quran';

const EDITION_LABEL: Record<string, string> = {
  'en.walk': 'English · Ibrahim Walk',
  'ur.khan': 'Urdu · Shamshad Ali Khan',
  [TAMIL_EDITION]: 'Tamil · Omar Sharif',
};
const reciterName = (id: string, t: (s: string) => string = (s) => s) =>
  RECITERS.find((r) => r.id === id)?.name ?? (EDITION_LABEL[id] ? t(EDITION_LABEL[id]) : id);

/** Lock screen / notification controls: surah and ayah, reciter, with next / previous. */
function lockScreenFor(surahName: string, prefs: AudioPrefs | null, i: number): LockScreen {
  const arabic = prefs?.arabic;
  return {
    metadata: {
      title: `${surahName} · Ayah ${i + 1}`,
      artist: arabic ? reciterName(prefs.reciter) : 'Quran translation',
      albumTitle: 'Deen Academy',
    },
    options: { showNextTrack: true, showPreviousTrack: true },
  };
}

/** Pill options in a wrapping row; the chosen one is filled. */
function Chips<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.modes, styles.flex]}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <SpringPressable
            key={String(o.id)}
            pressedScale={0.94}
            onPress={() => onChange(o.id)}
            style={[styles.mode, { backgroundColor: on ? theme.primary : theme.primarySoft }]}>
            <ThemedText type="small" numberOfLines={1} style={[styles.bold, { color: on ? theme.onPrimary : theme.primary }]}>
              {o.label}
            </ThemedText>
          </SpringPressable>
        );
      })}
    </View>
  );
}

export default function SurahScreen() {
  const theme = useTheme();
  const t = useT();
  const language = useAppState().settings.language;
  // `ayah` is set when opened from "Continue reading".
  const { surah: param, ayah: resumeAyah } = useLocalSearchParams<{ surah: string; ayah?: string }>();
  const number = Number(param);

  const [surah, setSurah] = useState<Surah | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True while recitation is under way (playing or paused mid-surah).
  const [started, setStarted] = useState(false);
  // Audio URLs per edition (e.g. [Arabic reciter, English]), one per ayah.
  const [urls, setUrls] = useState<string[][] | null>(null);
  const [prefs, setPrefs] = useState<AudioPrefs | null>(null);
  const [sheet, setSheet] = useState<'options' | 'reciters' | null>(null);
  const [allSurahs, setAllSurahs] = useState<SurahInfo[]>([]);

  // A native playlist holds every track of the surah and buffers the next one itself, so each ayah
  // starts cleanly instead of losing its first moment while it downloads.
  const playlist = useAudioPlaylist();
  const status = useAudioPlaylistStatus(playlist);
  const playing = status.playing;
  const listRef = useRef<FlatList<Surah['ayahs'][number]>>(null);

  const fetchData = () =>
    getSurah(number)
      .then(setSurah)
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    fetchData();
    loadAudioPrefs().then(setPrefs);
    getSurahList().then(setAllSurahs).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per surah
  }, [number]);

  // Remember the ayah at the top of the screen, so "Continue reading" brings her back here.
  const surahRef = useRef<Surah | null>(null);
  useEffect(() => {
    surahRef.current = surah;
  }, [surah]);
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { item: Surah['ayahs'][number]; index?: number | null; isViewable: boolean }[] }) => {
    const s = surahRef.current;
    const first = viewableItems.find((v) => v.isViewable)?.item;
    if (s && first) {
      saveQuranProgress({ surah: s.number, surahName: s.englishName, ayah: first.numberInSurah, total: s.numberOfAyahs });
    }
  });
  const [viewability] = useState({ itemVisiblePercentThreshold: 60 });

  // Where she stopped in this surah: from "Continue reading" (?ayah=), else the saved position if it's this
  // surah. The page opens there, and Play continues from there.
  const [savedAyah, setSavedAyah] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const fromLink = Number(resumeAyah);
    if (fromLink) setSavedAyah(fromLink);
    else loadQuranProgress().then((p) => active && setSavedAyah(p && p.surah === number ? p.ayah : null));
    return () => {
      active = false;
    };
  }, [number, resumeAyah]);
  const resumeIndex = savedAyah && surah && savedAyah > 1 && savedAyah <= surah.ayahs.length ? savedAyah - 1 : 0;
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!surah || !resumeIndex) return;
    const key = `${surah.number}:${resumeIndex}`;
    if (scrolledTo.current === key) return; // only once per opening
    scrolledTo.current = key;
    const timer = setTimeout(() => listRef.current?.scrollToIndex({ index: resumeIndex, viewPosition: 0.1, animated: false }), 300);
    return () => clearTimeout(timer);
  }, [surah, resumeIndex]);

  // Translation under each ayah: chosen here, else the app language.
  const translation = prefs?.translation ?? (language === 'ta' ? 'ta' : 'en');
  const showTamil = translation === 'ta';
  const usesTamil = showTamil || prefs?.voice === 'tamil';
  const editions = prefs ? editionsFor(prefs) : [];
  const per = Math.max(editions.length, 1); // tracks per ayah
  // Which ayah / part is loaded, from the playlist position.
  const current = started ? Math.floor(status.currentIndex / per) : null;
  const part = started ? status.currentIndex % per : 0;

  // Fetch the audio for the chosen editions.
  const editionsKey = editions.join(',');
  useEffect(() => {
    if (!editionsKey) return;
    let cancelled = false;
    Promise.all(editionsKey.split(',').map((e) => getSurahAudio(number, e)))
      .then((u) => !cancelled && setUrls(u))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [number, editionsKey]);

  // Load the playlist: for each ayah, its parts in order (Arabic, then English in "Arabic + English").
  const playlistKey = urls ? `${number}:${editionsKey}:${urls[0]?.length}` : '';
  useEffect(() => {
    playlist.pause();
    playlist.clear();
    if (!urls) return;
    for (let i = 0; i < urls[0].length; i++) for (const u of urls) playlist.add({ uri: u[i] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playlistKey captures the URLs
  }, [playlist, playlistKey]);

  // Follow the recitation: scroll to each new ayah, and reset when the surah ends.
  const lastAyah = useRef(-1);
  useEffect(() => {
    const sub = playlist.addListener('playlistStatusUpdate', (s) => {
      const ayah = Math.floor(s.currentIndex / per);
      if (s.playing && ayah !== lastAyah.current) {
        lastAyah.current = ayah;
        listRef.current?.scrollToIndex({ index: ayah, viewPosition: 0.25, animated: true });
      }
      if (s.didJustFinish && s.currentIndex >= s.trackCount - 1) setStarted(false);
    });
    return () => sub.remove();
  }, [playlist, per]);

  const stop = () => {
    playlist.pause();
    setStarted(false);
  };

  const changePrefs = (patch: Partial<AudioPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveAudioPrefs(next);
    setUrls(null);
    stop(); // the queue changes, so start fresh
  };

  // Only the text changes, so the recitation keeps playing.
  const changeTranslation = (translation: 'en' | 'ta') => {
    if (!prefs) return;
    const next = { ...prefs, translation };
    setPrefs(next);
    saveAudioPrefs(next);
  };

  // Arabic and the spoken translation can't both be off; turning one off keeps the other on.
  const setArabic = (on: boolean) => {
    if (!prefs) return;
    changePrefs(on || prefs.voice !== 'none' ? { arabic: on } : { arabic: false, voice: translation === 'ta' ? 'tamil' : 'english' });
  };
  const setVoice = (voice: Voice) => {
    if (!prefs) return;
    changePrefs(voice === 'none' ? { voice, arabic: true } : { voice });
  };

  const load = () => {
    setError(null);
    fetchData();
  };

  // Always land on the surah list — router.back() would go to whatever came before (e.g. the Prayers tab
  // when the surah was opened from a link or after a refresh).
  const prevSurah = allSurahs.find((x) => x.number === number - 1);
  const nextSurah = allSurahs.find((x) => x.number === number + 1);
  // Replace (not push) so the surah list stays directly underneath for "All surahs" / Android back.
  const goToSurah = (n: number) => {
    stop();
    router.replace(`/quran/${n}`);
  };

  const backToList = () => {
    stop();
    if (router.canDismiss()) router.dismissTo('/quran');
    else router.replace('/quran');
  };

  const lockFor = (i: number) => lockScreenFor(surah?.englishName ?? 'Quran', prefs, i);
  // Keep the lock screen title on the ayah that's playing.
  const surahName = surah?.englishName ?? 'Quran';
  useEffect(() => {
    if (started && current != null) playlist.updateLockScreenMetadata(lockScreenFor(surahName, prefs, current).metadata);
  }, [playlist, started, current, surahName, prefs]);

  const playAt = (i: number) => {
    if (!urls) return;
    setStarted(true);
    lastAyah.current = i;
    listRef.current?.scrollToIndex({ index: i, viewPosition: 0.25, animated: true });
    playlist.skipTo(i * per);
    playExclusive(playlist, lockFor(i));
  };

  const toggle = (i: number) => {
    if (current === i) {
      if (playing) playlist.pause();
      else playExclusive(playlist, lockFor(i));
    } else {
      playAt(i);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          ref={listRef}
          data={surah?.ayahs ?? []}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          keyExtractor={(a) => String(a.number)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Far ayahs aren't rendered yet: jump close by the average height, then land exactly.
            listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.1, animated: false }), 250);
          }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <SpringPressable onPress={backToList} style={styles.back}>
                <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                  {t('‹ All surahs')}
                </ThemedText>
              </SpringPressable>

              {surah && (
                <Animated.View entering={enter(0)} style={[styles.hero, { backgroundColor: theme.hero }]}>
                  <JasmineFlower size={90} rotate={18} style={[styles.heroFlower, { opacity: 0.14 }]} />
                  {/* Language and audio options live behind this small button. */}
                  <SpringPressable
                    accessibilityLabel={t('Audio and language')}
                    pressedScale={0.9}
                    onPress={() => setSheet('options')}
                    style={[styles.heroIcon, { backgroundColor: 'rgba(255, 253, 247, 0.14)' }]}>
                    <ThemedText style={[styles.heroIconText, { color: theme.onHero }]}>🎧</ThemedText>
                  </SpringPressable>
                  <ThemedText style={[styles.heroArabic, { color: theme.onHero }]}>{surah.name}</ThemedText>
                  <ThemedText style={[styles.heroName, { color: theme.onHero }]}>{surah.englishName}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                    {surah.englishNameTranslation} · {t('{n} ayahs', { n: surah.numberOfAyahs })} · {t(surah.revelationType)}
                  </ThemedText>
                  <SpringPressable onPress={() => playAt(resumeIndex)} style={[styles.playAll, { backgroundColor: theme.onHero }]}>
                    <ThemedText type="small" style={[styles.bold, { color: theme.hero }]}>
                      {resumeIndex ? t('▶  Continue from ayah {n}', { n: resumeIndex + 1 }) : t('▶  Play surah')}
                    </ThemedText>
                  </SpringPressable>
                  {!!resumeIndex && (
                    <SpringPressable onPress={() => playAt(0)} style={styles.fromStart}>
                      <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                        {t('or play from the start')}
                      </ThemedText>
                    </SpringPressable>
                  )}
                </Animated.View>
              )}

              {surah && hasBismillahHeader(surah.number) && (
                <Animated.View entering={enter(1)}>
                  <ThemedText style={[styles.bismillah, { color: theme.primary }]}>{BISMILLAH}</ThemedText>
                </Animated.View>
              )}

              {!surah && !error && <ActivityIndicator color={theme.primary} style={styles.loading} />}
              {error && (
                <SpringPressable onPress={load} style={[styles.errorBox, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {error} {t('Tap to retry.')}
                  </ThemedText>
                </SpringPressable>
              )}
            </View>
          }
          ListFooterComponent={
            surah ? (
              <View style={styles.surahNav}>
                {prevSurah ? (
                  <SpringPressable
                    pressedScale={0.95}
                    onPress={() => goToSurah(prevSurah.number)}
                    style={[styles.navPill, { borderColor: theme.border }]}>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      ‹ {prevSurah.englishName}
                    </ThemedText>
                  </SpringPressable>
                ) : (
                  <View />
                )}
                {nextSurah && (
                  <SpringPressable
                    pressedScale={0.95}
                    onPress={() => goToSurah(nextSurah.number)}
                    style={[styles.navPill, { backgroundColor: theme.primarySoft, borderColor: 'transparent' }]}>
                    <ThemedText type="small" style={[styles.bold, { color: theme.primary }]} numberOfLines={1}>
                      {nextSurah.englishName} ›
                    </ThemedText>
                  </SpringPressable>
                )}
              </View>
            ) : undefined
          }
          renderItem={({ item: a, index }) => {
            const active = current === index;
            return (
              <Animated.View
                entering={index < 8 ? FadeInDown.springify().damping(18).delay(120 + index * 60) : FadeIn}
                style={[
                  styles.ayah,
                  { backgroundColor: theme.backgroundElement, borderColor: active ? theme.primary : theme.border },
                  active && { backgroundColor: theme.primarySoft },
                ]}>
                <View style={styles.ayahTop}>
                  <JasmineBadge value={a.numberInSurah} size={42} active={active} />
                  <SpringPressable
                    pressedScale={0.9}
                    onPress={() => toggle(index)}
                    style={[styles.playBtn, { backgroundColor: active ? theme.primary : theme.primarySoft }]}>
                    <ThemedText style={[styles.playIcon, { color: active ? theme.onPrimary : theme.primary }]}>
                      {active && playing ? '❚❚' : '▶'}
                    </ThemedText>
                  </SpringPressable>
                </View>
                <ThemedText style={styles.arabic}>{a.arabic}</ThemedText>
                <View style={[styles.divider, { backgroundColor: theme.gold }]} />
                <ThemedText themeColor="textSecondary" style={styles.english}>
                  {showTamil && a.tamil ? a.tamil : a.english}
                </ThemedText>
              </Animated.View>
            );
          }}
        />

        {/* Mini player while reciting */}
        {surah && current !== null && (
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOutDown}
            style={[styles.player, { backgroundColor: theme.hero }]}>
            <View style={styles.flex}>
              <ThemedText type="smallBold" style={{ color: theme.onHero }}>
                {t('{surah} · Ayah {ayah}', { surah: surah.englishName, ayah: surah.ayahs[current].numberInSurah })}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                {reciterName(editions[part] ?? '', t)}
              </ThemedText>
            </View>
            <SpringPressable onPress={() => toggle(current)} style={[styles.playerBtn, { backgroundColor: theme.onHero }]}>
              <ThemedText style={[styles.playIcon, { color: theme.hero }]}>{playing ? '❚❚' : '▶'}</ThemedText>
            </SpringPressable>
            <SpringPressable onPress={stop} style={styles.playerStop}>
              <ThemedText type="small" style={[styles.bold, { color: theme.onHero }]}>
                {t('Stop')}
              </ThemedText>
            </SpringPressable>
          </Animated.View>
        )}
      </SafeAreaView>

      {/* Audio and language options; the reciter list opens inside the same sheet. */}
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable onPress={() => {}}>
            <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.sheet, { backgroundColor: theme.background }]}>
              <View style={[styles.grabber, { backgroundColor: theme.border }]} />
              {sheet === 'reciters' ? (
                <>
                  <SpringPressable onPress={() => setSheet('options')} style={styles.sheetBack}>
                    <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                      ‹ {t('Back')}
                    </ThemedText>
                  </SpringPressable>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.audioTitle}>
                    {t('CHOOSE RECITER')}
                  </ThemedText>
                  {RECITERS.map((r) => {
                    const on = prefs?.reciter === r.id;
                    return (
                      <SpringPressable
                        key={r.id}
                        pressedScale={0.98}
                        onPress={() => {
                          changePrefs({ reciter: r.id });
                          setSheet('options');
                        }}
                        style={[styles.reciterOption, on && { backgroundColor: theme.primarySoft }]}>
                        <ThemedText style={on && [styles.bold, { color: theme.primary }]}>{r.name}</ThemedText>
                        {on && <JasmineFlower size={16} petalColor={theme.primary} />}
                      </SpringPressable>
                    );
                  })}
                </>
              ) : (
                prefs && (
                  <View style={styles.sheetBody}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.audioTitle}>
                      {t('AUDIO & LANGUAGE')}
                    </ThemedText>
                    <View style={styles.optionRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.optionLabel}>
                        {t('Arabic')}
                      </ThemedText>
                      <Chips
                        options={[
                          { id: true, label: t('On') },
                          { id: false, label: t('Off') },
                        ]}
                        value={prefs.arabic}
                        onChange={setArabic}
                      />
                    </View>
                    {prefs.arabic && (
                      <SpringPressable onPress={() => setSheet('reciters')} style={styles.optionRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.optionLabel}>
                          {t('Reciter')}
                        </ThemedText>
                        <ThemedText type="small" style={[styles.bold, styles.flex, { color: theme.primary }]} numberOfLines={1}>
                          {reciterName(prefs.reciter, t)} ›
                        </ThemedText>
                      </SpringPressable>
                    )}
                    <View style={styles.optionRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.optionLabel}>
                        {t('Meaning')}
                      </ThemedText>
                      <Chips options={VOICES.map((v) => ({ id: v.id, label: t(v.label) }))} value={prefs.voice} onChange={setVoice} />
                    </View>
                    <View style={styles.optionRow}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.optionLabel}>
                        {t('Text')}
                      </ThemedText>
                      <Chips
                        options={[
                          { id: 'en' as const, label: t('English') },
                          { id: 'ta' as const, label: t('Tamil') },
                        ]}
                        value={translation}
                        onChange={changeTranslation}
                      />
                    </View>
                    {usesTamil && (
                      <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
                        {TAMIL_CREDIT}
                      </ThemedText>
                    )}
                    <SpringPressable onPress={() => setSheet(null)} style={[styles.sheetDone, { backgroundColor: theme.primary }]}>
                      <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('Done')}</ThemedText>
                    </SpringPressable>
                  </View>
                )
              )}
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  list: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingTop: TopTabInset + Spacing.two,
    paddingBottom: BottomTabInset + 110,
    gap: Spacing.three,
  },
  headerBlock: { gap: Spacing.three },
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.two },
  hero: { borderRadius: 28, padding: Spacing.four, alignItems: 'center', gap: Spacing.one, overflow: 'hidden' },
  heroFlower: { position: 'absolute', top: -24, right: -20 },
  fromStart: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two },
  heroIcon: { position: 'absolute', top: Spacing.three, left: Spacing.three, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroIconText: { fontSize: 16 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.two },
  sheetBody: { gap: Spacing.three },
  sheetBack: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  sheetDone: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 999, paddingVertical: Spacing.two + 2, marginTop: Spacing.one },
  heroArabic: { fontSize: 30, lineHeight: 50 },
  heroName: { fontFamily: Fonts?.serif, fontSize: 26, lineHeight: 32, fontWeight: 600 },
  playAll: { marginTop: Spacing.three, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  bismillah: { fontSize: 28, lineHeight: 52, textAlign: 'center', paddingVertical: Spacing.two },
  loading: { paddingVertical: Spacing.five },
  errorBox: { borderRadius: 16, padding: Spacing.three },
  ayah: { borderWidth: 1, borderRadius: 24, padding: Spacing.three + Spacing.one, gap: Spacing.three },
  ayahTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  surahNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.one },
  navPill: { borderWidth: 1, borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, maxWidth: '48%' },
  divider: { height: 1.5, width: 36, borderRadius: 1, opacity: 0.7, alignSelf: 'center' },
  playBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 13, fontWeight: 800 },
  arabic: { fontSize: 26, lineHeight: 50, textAlign: 'right', writingDirection: 'rtl' },
  english: { fontSize: 15, lineHeight: 23 },
  player: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.two,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
  },
  playerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playerStop: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  audioBox: { borderWidth: 1, borderRadius: 24, padding: Spacing.three, gap: Spacing.two },
  audioTitle: { letterSpacing: 1.5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  optionLabel: { width: 64 },
  credit: { fontSize: 11, lineHeight: 15 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mode: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  reciterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.one },
  reciterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
  },
});
