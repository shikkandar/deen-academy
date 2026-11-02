import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JasmineBadge, JasmineFlower } from '@/components/jasmine-flower';
import { enter, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useKeepAwakeWhile } from '@/hooks/use-keep-awake-while';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { tr } from '@/lib/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playExclusive, setPlaybackRate, type LockScreen } from '@/lib/audio-focus';
import { loadQuranPlace, saveQuranProgress, useReadingSession } from '@/lib/reading-progress';
import {
  TAMIL_CREDIT,
  TAMIL_EDITION,
  VOICES,
  BISMILLAH,
  editionsFor,
  getSurah,
  getSurahAudio,
  getSurahWords,
  getWordTimes,
  hasWordTimes,
  translationOf,
  voiceLanguage,
  type TextLanguage,
  getSurahList,
  hasBismillahHeader,
  loadAudioPrefs,
  RECITERS,
  saveAudioPrefs,
  type AudioPrefs,
  type Ayah,
  type Voice,
  type Surah,
  type SurahInfo,
  type WordTimes,
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
      title: `${surahName} · ${tr('Ayah {n}', { n: i + 1 })}`,
      artist: arabic ? reciterName(prefs.reciter) : tr('Quran translation'),
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

const SPEEDS = [1, 1.5, 2] as const;
const SPEED_KEY = 'quran.speed.v1';


/** The word being recited `ms` into the ayah: the last one that has started (held between words), or null. */
function wordAt(times: WordTimes | undefined, ms: number) {
  if (!times?.length) return null;
  let at: number | null = null;
  let end = 0;
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t && t[0] <= ms) at = i;
    if (t) end = t[1];
  }
  return ms > end + 400 ? null : at;
}

/** A translation's words as its word times count them (split on single spaces). */
function wordsOf(a: Ayah, lang: TextLanguage) {
  const text = lang === 'ta' ? a.tamil : lang === 'ur' ? a.urdu : lang === 'en' ? a.english : '';
  return text ? text.split(' ') : undefined;
}

/** Text word by word once its words are known (an ayah's Arabic, or its translation), the word being said
 * (`word`) in `color`. */
function WordText({ text, words, word, color, style }: {
  text: string;
  words?: string[];
  word: number | null;
  color: string;
  style: StyleProp<TextStyle>;
}) {
  if (!words?.length) return <ThemedText style={style}>{text}</ThemedText>;
  return (
    <ThemedText style={style}>
      {words.map((w, i) => (
        <Text key={i}>
          {i > 0 ? ' ' : ''}
          <Text style={i === word ? { color } : undefined}>{w}</Text>
        </Text>
      ))}
    </ThemedText>
  );
}

// The translation shown on the player's language button.
const LANG_SHORT: Record<TextLanguage, string> = { en: 'EN', ta: 'தமிழ்', ur: 'اردو', off: 'عربي' };

export default function SurahScreen() {
  const theme = useTheme();
  const t = useT();
  const layout = useLayout();
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
  // Updates ten times a second, so the highlighted word keeps up with the reciter.
  const playlist = useAudioPlaylist({ updateInterval: 100 });
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

  // Remember the ayah at the top of the screen, so "Continue reading" brings her back here (once she has stayed a moment).
  useReadingSession('quran', String(number));
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

  // Where she stopped in this surah: from "Continue reading" (?ayah=), else its place among the recent ones. The page
  // opens there, and Play continues from there.
  const [savedAyah, setSavedAyah] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const fromLink = Number(resumeAyah);
    if (fromLink) setSavedAyah(fromLink);
    else loadQuranPlace(number).then((p) => active && setSavedAyah(p?.ayah ?? null));
    return () => {
      active = false;
    };
  }, [number, resumeAyah]);
  const resumeIndex = savedAyah && surah && savedAyah > 1 && savedAyah <= surah.ayahs.length ? savedAyah - 1 : 0;
  const scrolledTo = useRef<string | null>(null);
  // The list stays hidden while it jumps to that ayah, so the page opens there without being seen to scroll.
  const [positioned, setPositioned] = useState(false);
  const jumpFailed = useRef(false);
  useEffect(() => {
    if (!surah || !resumeIndex) return;
    const key = `${surah.number}:${resumeIndex}`;
    if (scrolledTo.current === key) return; // only once per opening
    scrolledTo.current = key;
    setPositioned(false);
    jumpFailed.current = false;
    const timers = [
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: resumeIndex, viewPosition: 0.1, animated: false });
        // Landed straight away unless it had to jump in two steps (onScrollToIndexFailed shows it then).
        timers.push(setTimeout(() => !jumpFailed.current && setPositioned(true), 60));
      }, 300),
      setTimeout(() => setPositioned(true), 2000), // never leave the page hidden
    ];
    return () => timers.forEach(clearTimeout);
  }, [surah, resumeIndex]);
  const hidden = !!resumeIndex && !positioned;

  // Translation under each ayah: chosen here, else the app language.
  const translation = prefs?.translation ?? (language === 'ta' ? 'ta' : 'en');
  const showTamil = translation === 'ta';
  const usesTamil = showTamil || prefs?.voice === 'tamil';
  const editions = prefs ? editionsFor(prefs) : [];
  const per = Math.max(editions.length, 1); // tracks per ayah
  // Which ayah / part is loaded, from the playlist position.
  const current = started ? Math.floor(status.currentIndex / per) : null;
  const part = started ? status.currentIndex % per : 0;

  // The Arabic word by word, and (for reciters that have them) when each word is recited.
  const [words, setWords] = useState<string[][] | null>(null);
  useEffect(() => {
    getSurahWords(number).then(setWords).catch(() => {});
  }, [number]);
  // Each playing edition that knows when its words are said (the reciter, the English translation).
  const timedKey = editions.filter(hasWordTimes).join(',');
  const [times, setTimes] = useState<{ key: string; byEdition: Record<string, WordTimes[]> } | null>(null);
  useEffect(() => {
    if (!timedKey) return;
    const key = `${number}:${timedKey}`;
    const list = timedKey.split(',');
    Promise.all(list.map((e) => getWordTimes(number, e)))
      .then((all) => setTimes({ key, byEdition: Object.fromEntries(list.map((e, i) => [e, all[i]])) }))
      .catch(() => {});
  }, [number, timedKey]);
  const byEdition = times?.key === `${number}:${timedKey}` ? times.byEdition : null;
  const playingEdition = current !== null ? (editions[part] ?? '') : '';
  const word = current !== null && byEdition ? wordAt(byEdition[playingEdition]?.[current], status.currentTime * 1000) : null;
  // Which text that word is in: the Arabic, or the spoken translation's language.
  const wordIn = current === null ? null : (voiceLanguage(playingEdition) ?? 'arabic');

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
  // When it was last heard playing (see resume below).
  const lastPlaying = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);
  useEffect(() => {
    const sub = playlist.addListener('playlistStatusUpdate', (s) => {
      const ayah = Math.floor(s.currentIndex / per);
      if (s.playing) lastPlaying.current = Date.now();
      if (s.playing && ayah !== lastAyah.current) {
        lastAyah.current = ayah;
        listRef.current?.scrollToIndex({ index: ayah, viewPosition: 0.25, animated: true });
      }
      if (s.didJustFinish && s.currentIndex >= s.trackCount - 1) setStarted(false);
    });
    return () => sub.remove();
  }, [playlist, per]);

  // The screen stays on while the Quran is reciting (it may sleep again once paused or stopped).
  useKeepAwakeWhile(started && playing, 'quran-player');

  // Full-screen "Now Playing" view, opened from the mini player.
  const [full, setFull] = useState(false);

  // Where it was stopped, so the mini player stays and can resume from that ayah.
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const stop = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    playlist.pause();
    if (current != null) setStoppedAt(current);
    setStarted(false);
  };
  // ✕ on the player: stop the recitation and put the player away.
  const close = () => {
    stop();
    setStoppedAt(null);
  };

  // Recitation speed, remembered across surahs.
  const [speed, setSpeed] = useState<number>(1);
  useEffect(() => {
    AsyncStorage.getItem(SPEED_KEY)
      .then((v) => v && setSpeed(Number(v) || 1))
      .catch(() => {});
  }, []);
  useEffect(() => {
    setPlaybackRate(playlist, speed);
  }, [playlist, speed, status.currentIndex]);
  const chooseSpeed = (v: number) => {
    setSpeed(v);
    AsyncStorage.setItem(SPEED_KEY, String(v)).catch(() => {});
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
  const changeTranslation = (translation: TextLanguage) => {
    if (!prefs) return;
    const next = { ...prefs, translation };
    setPrefs(next);
    saveAudioPrefs(next);
  };

  // Arabic and the spoken translation can't both be off; turning one off keeps the other on.
  const setArabic = (on: boolean) => {
    if (!prefs) return;
    changePrefs(on || prefs.voice !== 'none' ? { arabic: on } : { arabic: false, voice: translation === 'ta' ? 'tamil' : translation === 'ur' ? 'urdu' : 'english' });
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
    setStoppedAt(null);
    lastAyah.current = i;
    listRef.current?.scrollToIndex({ index: i, viewPosition: 0.25, animated: true });
    playlist.skipTo(i * per);
    playExclusive(playlist, lockFor(i));
  };

  // Playing the whole surah opens the full Now Playing page; ⌄ minimises it to the mini player.
  const playSurah = (i: number) => {
    playAt(i);
    setFull(true);
  };

  // Resume after a pause. After a long pause the phone drops the ayah's audio stream, and play() on it then does
  // nothing until the surah is reopened, so the paused ayah is loaded again first; and if it still hasn't started
  // a few seconds later, it is loaded and played once more.
  const armRetry = (retry: () => void) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(retry, 3000);
  };
  const reload = () => {
    try {
      playlist.skipTo(playlist.currentIndex);
    } catch {}
  };
  const resume = (i: number) => {
    if (!playlist.isLoaded || Date.now() - lastPlaying.current > 15_000) reload();
    playExclusive(playlist, lockFor(i));
    armRetry(() => {
      if (playlist.playing) return;
      reload();
      playExclusive(playlist, lockFor(i));
    });
  };

  const toggle = (i: number) => {
    if (current === i) {
      if (playing) {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        playlist.pause();
      } else resume(i);
    } else {
      playAt(i);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Desktop: a comfortable reading width; the mini player sits at the bottom of this column. */}
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.readingWidth }]}>
        <FlatList
          ref={listRef}
          style={hidden && styles.hidden}
          data={surah?.ayahs ?? []}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          keyExtractor={(a) => String(a.number)}
          contentContainerStyle={[styles.list, { paddingTop: layout.topInset + Spacing.two }]}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Far ayahs aren't rendered yet: jump close by the average height, then land exactly.
            jumpFailed.current = true;
            listRef.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
            setTimeout(() => {
              jumpFailed.current = false;
              listRef.current?.scrollToIndex({ index, viewPosition: 0.1, animated: false });
              setTimeout(() => !jumpFailed.current && setPositioned(true), 60);
            }, 250);
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
                  <SpringPressable onPress={() => playSurah(resumeIndex)} style={[styles.playAll, { backgroundColor: theme.onHero }]}>
                    <ThemedText type="small" style={[styles.bold, { color: theme.hero }]}>
                      {resumeIndex ? t('▶  Continue from ayah {n}', { n: resumeIndex + 1 }) : t('▶  Play surah')}
                    </ThemedText>
                  </SpringPressable>
                  {!!resumeIndex && (
                    <SpringPressable onPress={() => playSurah(0)} style={styles.fromStart}>
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
                <WordText
                  style={styles.arabic}
                  text={a.arabic}
                  words={words?.[index]}
                  word={active && wordIn === 'arabic' ? word : null}
                  color={theme.primary}
                />
                {translation !== 'off' && (
                  <>
                    <View style={[styles.divider, { backgroundColor: theme.gold }]} />
                    <WordText
                      style={[styles.english, { color: theme.textSecondary }, translation === 'ur' && styles.urdu]}
                      text={translationOf(a, translation) ?? ''}
                      words={active && wordIn === translation ? wordsOf(a, translation) : undefined}
                      word={word}
                      color={theme.primary}
                    />
                  </>
                )}
              </Animated.View>
            );
          }}
        />

        {/* Mini player while reciting, and after Stop (to resume from that ayah) */}
        {surah && (current !== null || stoppedAt !== null) && (
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOutDown}
            style={[styles.player, { backgroundColor: theme.hero }]}>
            <View style={styles.playerTop}>
              {/* Language and voice, on the left where it's easy to see and reach. */}
              <SpringPressable
                accessibilityLabel={t('Audio and language')}
                onPress={() => setSheet('options')}
                style={[styles.langPill, { backgroundColor: 'rgba(255, 253, 247, 0.18)' }]}>
                <ThemedText style={{ color: theme.onHero }}>🎧</ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.onHero }}>
                  {LANG_SHORT[translation]}
                </ThemedText>
              </SpringPressable>
              <Pressable onPress={() => setFull(true)} style={styles.flex}>
                <ThemedText type="smallBold" style={{ color: theme.onHero }}>
                  {t('{surah} · Ayah {ayah}', { surah: surah.englishName, ayah: surah.ayahs[current ?? stoppedAt ?? 0].numberInSurah })}  ⌃
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                  {current === null ? t('Stopped · tap ▶ to resume') : reciterName(editions[part] ?? '', t)}
                </ThemedText>
              </Pressable>
              <SpringPressable
                onPress={() => (current === null ? playAt(stoppedAt ?? 0) : toggle(current))}
                style={[styles.playerBtn, { backgroundColor: theme.onHero }]}>
                <ThemedText style={[styles.playIcon, { color: theme.hero }]}>{current !== null && playing ? '❚❚' : '▶'}</ThemedText>
              </SpringPressable>
              <SpringPressable
                accessibilityRole="button"
                accessibilityLabel={t('Close')}
                onPress={close}
                style={[styles.playerIcon, { backgroundColor: 'rgba(255, 253, 247, 0.14)' }]}>
                <ThemedText style={[styles.bold, { color: theme.onHero, fontSize: 18 }]}>✕</ThemedText>
              </SpringPressable>
            </View>
            <View style={styles.speedRow}>
              {SPEEDS.map((v) => (
                <SpringPressable
                  key={v}
                  pressedScale={0.92}
                  onPress={() => chooseSpeed(v)}
                  style={[styles.speedChip, { backgroundColor: speed === v ? theme.onHero : 'rgba(255, 253, 247, 0.14)' }]}>
                  <ThemedText type="small" style={[styles.bold, { color: speed === v ? theme.hero : theme.onHero }]}>
                    {v}x
                  </ThemedText>
                </SpringPressable>
              ))}
            </View>
          </Animated.View>
        )}
      </SafeAreaView>

      {/* Now Playing: the whole ayah, big, following the recitation, with previous / next. */}
      {surah && (
        <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
          <ThemedView style={[styles.full, { backgroundColor: theme.hero }]}>
            {/* A jasmine garden at night: the leaf green deepening downwards, big faint flowers in the corners,
                a few petals around the ayah and a soft golden glow behind it. */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <LinearGradient colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.32)']} style={StyleSheet.absoluteFill} />
              {[340, 250, 170].map((d) => (
                <View
                  key={d}
                  style={[styles.glow, { width: d, height: d, borderRadius: d / 2, marginTop: -d / 2, backgroundColor: theme.gold }]}
                />
              ))}
              <JasmineFlower size={220} rotate={18} style={[styles.decor, styles.decorTop]} />
              <JasmineFlower size={170} rotate={-12} style={[styles.decor, styles.decorBottom]} />
              <JasmineFlower size={26} rotate={30} style={[styles.petal, { top: '22%', left: '12%' }]} />
              <JasmineFlower size={18} rotate={-20} style={[styles.petal, { top: '30%', right: '14%' }]} />
              <JasmineFlower size={22} rotate={8} style={[styles.petal, { top: '62%', right: '10%' }]} />
              <JasmineFlower size={14} rotate={40} style={[styles.petal, { top: '68%', left: '18%' }]} />
            </View>
            <SafeAreaView style={[styles.fullSafe, layout.wide && styles.fullSafeWide]}>
              {(() => {
                const i = current ?? stoppedAt ?? 0;
                const a = surah.ayahs[i];
                // While a spoken translation plays, only its text; while the Arabic plays, only the Arabic; when
                // stopped, the Arabic with the chosen translation.
                const spoken = current !== null ? voiceLanguage(editions[part] ?? '') : null;
                const showArabic = current === null || spoken === null;
                const meaning = spoken ? translationOf(a, spoken) : current === null ? translationOf(a, translation) : null;
                const meaningLang = spoken ?? translation;
                const progress = current !== null && status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
                const go = (to: number) => playAt(Math.min(Math.max(to, 0), surah.ayahs.length - 1));
                return (
                  <>
                    <View style={styles.fullTop}>
                      <SpringPressable
                        onPress={() => setFull(false)}
                        accessibilityRole="button"
                        accessibilityLabel={t('Minimise')}
                        hitSlop={8}
                        style={[styles.fullClose, styles.fullRound]}>
                        <View style={[styles.chevron, { borderColor: theme.onHero }]} />
                      </SpringPressable>
                      <View style={styles.fullTitle}>
                        <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                          {t('NOW PLAYING')}
                        </ThemedText>
                        <ThemedText type="smallBold" style={{ color: theme.onHero }} numberOfLines={1}>
                          {surah.englishName} · {surah.name}
                        </ThemedText>
                      </View>
                      <SpringPressable onPress={() => setSheet('options')} style={[styles.fullClose, styles.fullRound]}>
                        <ThemedText style={{ color: theme.onHero, fontSize: 17 }}>🎧</ThemedText>
                      </SpringPressable>
                    </View>

                    <View style={styles.fullMiddle}>
                      {/* The ayah's number, in the corner. */}
                      <Animated.View key={`n${i}`} entering={FadeIn.duration(350)} style={styles.fullNumber}>
                        <JasmineBadge value={a.numberInSurah} size={40} active />
                      </Animated.View>
                      <ScrollView contentContainerStyle={styles.fullText} showsVerticalScrollIndicator={false}>
                        <Animated.View key={i} entering={FadeIn.duration(350)} style={styles.fullAyah}>
                          {showArabic && (
                            <WordText
                              style={[styles.fullArabic, { color: theme.onHero }]}
                              text={a.arabic}
                              words={words?.[i]}
                              word={current === i && wordIn === 'arabic' ? word : null}
                              color={theme.gold}
                            />
                          )}
                          {meaning && (
                            <WordText
                              text={meaning}
                              words={spoken && wordIn === spoken ? wordsOf(a, spoken) : undefined}
                              word={word}
                              color={theme.gold}
                              style={[
                                spoken ? styles.fullSpoken : styles.fullMeaning,
                                { color: spoken ? theme.onHero : theme.onHeroMuted },
                                meaningLang === 'ur' && styles.urdu,
                                meaningLang === 'ur' && styles.center,
                              ]}
                            />
                          )}
                        </Animated.View>
                      </ScrollView>
                    </View>

                    <View style={styles.fullBottom}>
                      <View style={[styles.track, { backgroundColor: 'rgba(255, 253, 247, 0.2)' }]}>
                        <View style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: theme.gold }]} />
                      </View>
                      <View style={styles.trackLabels}>
                        <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
                          {t('Ayah {n} of {total}', { n: a.numberInSurah, total: surah.numberOfAyahs })}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.onHeroMuted }} numberOfLines={1}>
                          {current === null ? t('Stopped') : reciterName(editions[part] ?? '', t)}
                        </ThemedText>
                      </View>

                      <View style={styles.fullControls}>
                        <View style={styles.fullSide} />
                        <SpringPressable accessibilityLabel={t('Previous ayah')} onPress={() => go(i - 1)} style={[styles.fullSkip, styles.fullRound]}>
                          <ThemedText style={[styles.fullSkipIcon, { color: theme.onHero }]}>◀◀</ThemedText>
                        </SpringPressable>
                        <SpringPressable
                          onPress={() => (current === null ? playAt(i) : toggle(current))}
                          style={[styles.fullPlay, { backgroundColor: theme.onHero }]}>
                          <ThemedText style={[styles.fullPlayIcon, { color: theme.hero }]}>
                            {current !== null && playing ? '❚❚' : '▶'}
                          </ThemedText>
                        </SpringPressable>
                        <SpringPressable accessibilityLabel={t('Next ayah')} onPress={() => go(i + 1)} style={[styles.fullSkip, styles.fullRound]}>
                          <ThemedText style={[styles.fullSkipIcon, { color: theme.onHero }]}>▶▶</ThemedText>
                        </SpringPressable>
                        <SpringPressable
                          pressedScale={0.92}
                          onPress={() => chooseSpeed(SPEEDS[((SPEEDS as readonly number[]).indexOf(speed) + 1) % SPEEDS.length])}
                          style={[styles.fullSide, styles.fullSpeed]}>
                          <ThemedText type="smallBold" style={{ color: theme.gold }}>
                            {speed}x
                          </ThemedText>
                        </SpringPressable>
                      </View>
                    </View>
                  </>
                );
              })()}
            </SafeAreaView>
          </ThemedView>
        </Modal>
      )}

      {/* Audio and language options; the reciter list opens inside the same sheet. Mounted only while open, so on
          the web it is laid over Now Playing when opened from there (a modal mounted earlier stays under it). */}
      {sheet && (
      <Modal visible transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={[styles.backdrop, layout.wide && styles.backdropWide]} onPress={() => setSheet(null)}>
          <Pressable onPress={() => {}} style={layout.wide && styles.sheetWrapWide}>
            <Animated.View
              entering={FadeInDown.springify().damping(18)}
              style={[styles.sheet, layout.wide && styles.sheetWide, { backgroundColor: theme.background }]}>
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
                          { id: 'ur' as const, label: t('Urdu') },
                          { id: 'off' as const, label: t('Off') },
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
      )}
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
  hidden: { opacity: 0 },
  arabic: { fontSize: 26, lineHeight: 50, textAlign: 'right', writingDirection: 'rtl' },
  english: { fontSize: 15, lineHeight: 23 },
  urdu: { writingDirection: 'rtl', textAlign: 'right', fontSize: 17, lineHeight: 30 },
  center: { textAlign: 'center' },
  player: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.two,
    borderRadius: 24,
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
  },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  langPill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, borderRadius: 18, paddingHorizontal: Spacing.two + 2 },
  playerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  speedRow: { flexDirection: 'row', gap: Spacing.two },
  speedChip: { borderRadius: 999, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  centerRow: { justifyContent: 'center' },
  full: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  glow: { position: 'absolute', top: '40%', alignSelf: 'center', opacity: 0.035 },
  decor: { position: 'absolute', opacity: 0.07 },
  decorTop: { top: -60, right: -70 },
  decorBottom: { bottom: 120, left: -80 },
  petal: { position: 'absolute', opacity: 0.16 },
  fullSafe: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
  fullSafeWide: { maxWidth: 760, paddingVertical: Spacing.three },
  fullTop: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.two },
  fullClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fullRound: { borderRadius: 999, backgroundColor: 'rgba(255, 253, 247, 0.12)' },
  chevron: { width: 10, height: 10, borderRightWidth: 2, borderBottomWidth: 2, marginTop: -4, transform: [{ rotate: '45deg' }] },
  fullTitle: { flex: 1, alignItems: 'center' },
  fullMiddle: { flex: 1 },
  fullNumber: { position: 'absolute', top: Spacing.two, left: 0, zIndex: 1 },
  fullText: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.five },
  fullAyah: { alignItems: 'center', gap: Spacing.two },
  fullArabic: { fontSize: 32, lineHeight: 56, textAlign: 'center', writingDirection: 'rtl' },
  fullMeaning: { fontSize: 17, lineHeight: 27, textAlign: 'center' },
  fullSpoken: { fontSize: 22, lineHeight: 34, textAlign: 'center' },
  fullBottom: { gap: Spacing.three, paddingBottom: Spacing.four },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2 },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  fullControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  fullSide: { width: 44 },
  fullSpeed: { height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 253, 247, 0.12)' },
  fullSkip: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fullSkipIcon: { fontSize: 14, fontWeight: 700 },
  fullPlay: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  fullPlayIcon: { fontSize: 18, fontWeight: 800 },
  playerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  audioBox: { borderWidth: 1, borderRadius: 24, padding: Spacing.three, gap: Spacing.two },
  audioTitle: { letterSpacing: 1.5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  optionLabel: { width: 64 },
  credit: { fontSize: 11, lineHeight: 15 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mode: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  reciterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.two },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  // Desktop: the options sheet becomes a centred dialog.
  backdropWide: { justifyContent: 'center', alignItems: 'center', padding: Spacing.four },
  sheetWrapWide: { width: '100%', maxWidth: 560 },
  sheetWide: { borderRadius: 28, paddingBottom: Spacing.four },
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
