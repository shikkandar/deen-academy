import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AfterNamazDuas } from '@/components/after-namaz-duas';
import { AndroidAppCard } from '@/components/android-app-card';
import { ContinueHadith, ContinueQuran } from '@/components/continue-reading';
import { JasmineFlower } from '@/components/jasmine-flower';
import { NamazAssistant } from '@/components/namaz-assistant';
import { PrayerHadithCard } from '@/components/prayer-hadith-card';
import { enter, FloatingFlower, SpringPressable } from '@/components/motion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { reminderForToday } from '@/constants/content';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { localeFor } from '@/lib/i18n';
import { useAppState } from '@/lib/app-state';
import { rakatFor } from '@/lib/rakat';
import { dueTime, formatTime, getCurrentPrayer, getDayTimes, getLastPrayer, getNextPrayer, getPrayerWindow, isAfterNamaz, type PrayerTime } from '@/lib/prayer';


function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function HomeScreen() {
  const [assistant, setAssistant] = useState(false);
  const theme = useTheme();
  const { place, settings, locationPermission, loading, requestLocation, refreshLocation } = useAppState();
  const t = useT();
  const now = useNow();
  const layout = useLayout();

  if (!place) {
    const needsPermission = !loading && locationPermission !== 'granted';
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={[styles.safeArea, styles.center]}>
          <View style={[styles.permissionFlower, { backgroundColor: theme.primarySoft }]}>
            <FloatingFlower size={72} period={20} />
          </View>
          <Animated.View entering={enter(0)}>
            <ThemedText style={[styles.serifTitle, styles.centerText]}>{t('Assalamu alaikum')}</ThemedText>
          </Animated.View>
          <Animated.View entering={enter(1)}>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {!needsPermission
                ? t('Finding your location…')
                : locationPermission === 'blocked'
                  ? t('Location is turned off for this app. Open Settings → Permissions → Location and choose “Allow only while using the app”.')
                  : t('Prayer times depend on where you are. Allow location so Fajr to Isha are exact for your city.')}
            </ThemedText>
          </Animated.View>
          {needsPermission && (
            <Animated.View entering={enter(2)}>
              <SpringPressable onPress={requestLocation} style={[styles.pill, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.pillText, { color: theme.onPrimary }]}>
                  {locationPermission === 'blocked' ? t('Open Settings') : t('Allow location')}
                </ThemedText>
              </SpringPressable>
            </Animated.View>
          )}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const { prayers, sunrise } = getDayTimes(place, now, settings);
  const next = getNextPrayer(place, settings, now);
  const current = getCurrentPrayer(place, settings, now);
  // The prayer the screen is about: the one happening now, otherwise the next one.
  const focus = current ?? next;
  const last = getLastPrayer(place, settings, now);
  // The Namaz Assistant leads the prayer whose time is still running (Isha until Fajr), else the next one.
  const prayerWindow = getPrayerWindow(place, settings, now);
  const assistantPrayer = prayerWindow?.prayer.name ?? next.name;
  const afterNamaz = !!last && isAfterNamaz(last, settings, now);
  const rows = [prayers[0], { name: 'Sunrise', time: sunrise, jamaat: null }, ...prayers.slice(1)];
  const dateLabel = now.toLocaleDateString(localeFor(settings.language) ?? [], { weekday: 'long', day: 'numeric', month: 'long' });

  const greeting = (
    <>
      {/* Greeting */}
      <Animated.View entering={enter(0)} style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText style={styles.serifTitle}>{t('Assalamu alaikum')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dateLabel}
          </ThemedText>
        </View>
        <View style={[styles.headerFlower, { backgroundColor: theme.primarySoft }]}>
          <FloatingFlower size={40} rotate={12} period={30} />
        </View>
      </Animated.View>

      {/* A different reminder every day. */}
      <Animated.View entering={enter(1)}>
        <ThemedText style={[styles.dailyLine, { color: theme.primary }]}>“{reminderForToday(settings.language, now)}”</ThemedText>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <SpringPressable
          onPress={refreshLocation}
          style={[styles.locationPill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <ThemedText type="small">
            {place.city ?? t('Current location')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('· refresh')}
          </ThemedText>
        </SpringPressable>
      </Animated.View>
    </>
  );

  // The prayer that's on now, or the next one with a countdown.
  const hero = (
    <Animated.View entering={enter(2)} style={[styles.hero, { backgroundColor: theme.hero }]}>
      <FloatingFlower size={110} rotate={18} period={60} style={[styles.heroFlowerBig, { opacity: 0.16 }]} />
      <FloatingFlower size={54} rotate={-10} period={45} style={[styles.heroFlowerSmall, { opacity: 0.12 }]} />
      <FloatingFlower size={26} rotate={30} period={35} style={[styles.heroFlowerTiny, { opacity: 0.2 }]} />

      <ThemedText type="small" style={[styles.heroLabel, { color: theme.onHeroMuted }]}>
        {current ? t('IT’S TIME FOR') : t('NEXT PRAYER')}
      </ThemedText>
      {/* Keyed so the name and time cross-fade when the prayer changes. */}
      <Animated.View key={focus.time.getTime()} entering={FadeIn.duration(500)} exiting={FadeOut.duration(250)} style={styles.heroCenter}>
        <ThemedText style={[styles.heroName, { color: theme.onHero }]}>{t(focus.name)}</ThemedText>
        <ThemedText style={[styles.heroTime, { color: theme.onHero }]}>
          {current && current.jamaat ? t('Jamaat {time}', { time: formatTime(current.jamaat) }) : formatTime(focus.time)}
        </ThemedText>
        {!current && next.jamaat && (
          <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
            {t('Jamaat {time}', { time: formatTime(next.jamaat) })}
            {settings.masjid.name ? ` · ${settings.masjid.name}` : ''}
          </ThemedText>
        )}
      </Animated.View>
      <View style={styles.heroCountdown}>
        <ThemedText type="small" style={{ color: theme.onHero, fontVariant: ['tabular-nums'] }}>
          {current
            ? t('Next: {name} at {time}', { name: t(next.name), time: formatTime(next.time) })
            : t('in {time}', { time: formatCountdown(next.time.getTime() - now.getTime()) })}
        </ThemedText>
      </View>

      {/* Rakat of this prayer, in the order they're prayed. */}
      <View style={styles.rakatRow}>
        {rakatFor(focus.name, settings.madhab).parts.map((r, i) => {
          const fard = r.kind === 'Fard';
          return (
            <View
              key={i}
              style={[
                styles.rakatChip,
                fard
                  ? { backgroundColor: theme.gold }
                  : r.optional
                    ? { borderWidth: 1, borderColor: theme.onHeroMuted, borderStyle: 'dashed' }
                    : { backgroundColor: 'rgba(255, 253, 247, 0.14)' },
              ]}>
              <ThemedText type="small" style={[styles.rakatNum, { color: fard ? theme.hero : theme.onHero }]}>
                {r.count}
              </ThemedText>
              <ThemedText type="small" style={{ color: fard ? theme.hero : theme.onHeroMuted }}>
                {t(r.kind)}
                {r.optional ? ` · ${t('optional')}` : ''}
              </ThemedText>
            </View>
          );
        })}
      </View>
      <ThemedText type="small" style={{ color: theme.onHeroMuted }}>
        {t('{n} rakat · {madhab}', { n: rakatFor(focus.name, settings.madhab).total, madhab: t(settings.madhab === 'Shafi' ? "Shafi'i" : 'Hanafi') })}
      </ThemedText>
    </Animated.View>
  );

  // Right after the namaz, the adhkar come first.
  const duasNow = afterNamaz && last && (
    <Animated.View entering={enter(3)}>
      <AfterNamazDuas key={last.time.getTime()} prayer={last} highlight />
    </Animated.View>
  );

  const assistantRows = (
    <Animated.View entering={enter(3)}>
      <SpringPressable
        pressedScale={0.98}
        onPress={() => setAssistant(true)}
        style={[styles.assistant, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
        <JasmineFlower size={18} />
        <View style={styles.assistantText}>
          <ThemedText style={[styles.bold, { color: theme.primary }]}>
            {t('Pray {prayer} with the Namaz Assistant', { prayer: t(assistantPrayer) })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {prayerWindow
              ? t('{prayer} time until {time} · ', { prayer: t(prayerWindow.prayer.name), time: formatTime(prayerWindow.endsAt) })
              : ''}
            {t('Led aloud like an imam · choose length and speed')}
          </ThemedText>
        </View>
        <ThemedText style={[styles.bold, { color: theme.primary }]}>▶</ThemedText>
      </SpringPressable>
      <NamazAssistant prayer={assistantPrayer} visible={assistant} onClose={() => setAssistant(false)} />
      <SpringPressable
        pressedScale={0.98}
        onPress={() => router.push('/qibla')}
        style={[styles.assistant, styles.qiblaRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText style={styles.qiblaIcon}>🕋</ThemedText>
        <View style={styles.assistantText}>
          <ThemedText style={[styles.bold, { color: theme.primary }]}>{t('Qibla direction')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Compass to the Kaaba · buzzes when you face it')}
          </ThemedText>
        </View>
        <ThemedText style={[styles.bold, { color: theme.primary }]}>›</ThemedText>
      </SpringPressable>
    </Animated.View>
  );

  const hadithCard = (
    <Animated.View entering={enter(3)}>
      <PrayerHadithCard key={focus.time.getTime()} prayer={focus} />
    </Animated.View>
  );

  // Pick up the Quran / Hadith where she left off.
  const continueBlock = (
    <Animated.View entering={enter(4)} style={styles.continueBlock}>
      <ContinueQuran />
      <ContinueHadith />
    </Animated.View>
  );

  // Today's times
  const todayCard = (
    <Animated.View
      entering={enter(4)}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={[styles.colHead, styles.cardTitle]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.spaced}>
          {t('TODAY')}
        </ThemedText>
        <View style={styles.rowRight}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.timeCol}>
            {t('Azan')}
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.timeCol}>
            {t('Iqamah')}
          </ThemedText>
        </View>
      </View>
      {rows.map((p, i) => {
        const isNext = p.time.getTime() === next.time.getTime();
        const past = p.time < now && !isNext;
        const color = isNext ? theme.primary : past ? theme.textSecondary : theme.text;
        return (
          <Animated.View
            key={p.name}
            entering={enter(5 + i)}
            layout={LinearTransition.springify().damping(18)}
            style={[
              styles.row,
              i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
              isNext && [styles.rowNext, { backgroundColor: theme.primarySoft }],
            ]}>
            <View style={styles.rowLeft}>
              <JasmineFlower
                size={18}
                petalColor={isNext ? theme.primary : past ? theme.border : theme.backgroundSelected}
                centerColor={isNext ? theme.gold : past ? theme.backgroundSelected : theme.gold}
              />
              <ThemedText style={[{ color }, isNext && styles.bold]}>{t(p.name)}</ThemedText>
            </View>
            <View style={styles.rowRight}>
              <ThemedText style={[styles.timeCol, { color }, isNext && styles.bold]}>{formatTime(p.time)}</ThemedText>
              {/* Iqamah: the masjid's Jamaat, else an estimate (~) from "Namaz starts after Azan"; none for Sunrise */}
              <ThemedText style={[styles.timeCol, { color: p.jamaat ? color : theme.textSecondary }, isNext && !!p.jamaat && styles.bold]}>
                {p.name === 'Sunrise' ? '—' : p.jamaat ? formatTime(p.jamaat) : `~${formatTime(dueTime(p as PrayerTime, settings))}`}
              </ThemedText>
            </View>
          </Animated.View>
        );
      })}
    </Animated.View>
  );

  const duasLater = !afterNamaz && last && (
    <Animated.View entering={FadeIn.delay(700).duration(500)}>
      <AfterNamazDuas key={last.time.getTime()} prayer={last} highlight={false} />
    </Animated.View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, { maxWidth: layout.maxWidth }]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: layout.topInset + Spacing.three }, layout.wide && styles.scrollWide]}
          showsVerticalScrollIndicator={false}>
          <AndroidAppCard />
          {greeting}

          {layout.wide ? (
            // Desktop: the prayer and what to do now on the left; today's times and reading on the right.
            <View style={styles.columns}>
              <View style={styles.column}>
                {hero}
                {duasNow}
                {assistantRows}
                {duasLater}
              </View>
              <View style={styles.column}>
                {todayCard}
                {hadithCard}
                {continueBlock}
              </View>
            </View>
          ) : (
            <>
              {hero}
              {duasNow}
              {assistantRows}
              {hadithCard}
              {continueBlock}
              {todayCard}
              {duasLater}
            </>
          )}

          <Animated.View entering={FadeIn.delay(900).duration(600)} style={styles.footerBlock}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {t('One notification at each Azan · Jamaat reminder when the masjid time is set')}
            </ThemedText>
            <View style={styles.footer}>
              <JasmineFlower size={14} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>
                Deen Academy
              </ThemedText>
              <JasmineFlower size={14} />
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  dailyLine: { fontFamily: Fonts?.serif, fontStyle: 'italic', fontSize: 16, lineHeight: 24 },
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  centerText: { textAlign: 'center' },
  bold: { fontWeight: 700 },
  scroll: {
    paddingHorizontal: Spacing.three + Spacing.one,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  // Desktop: roomier sides, and the two columns below the greeting.
  scrollWide: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.five },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.four },
  column: { flex: 1, minWidth: 0, gap: Spacing.three },
  serifTitle: { fontFamily: Fonts?.serif, fontSize: 34, lineHeight: 42, fontWeight: 600 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: 2 },
  permissionFlower: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  continueBlock: { gap: Spacing.two },
  headerFlower: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hero: {
    borderRadius: 28,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    overflow: 'hidden',
  },
  heroCenter: { alignItems: 'center', gap: Spacing.one },
  heroFlowerBig: { position: 'absolute', top: -28, right: -24 },
  heroFlowerSmall: { position: 'absolute', bottom: -12, left: 14 },
  heroFlowerTiny: { position: 'absolute', top: 22, left: 28 },
  heroLabel: { letterSpacing: 2 },
  heroName: { fontFamily: Fonts?.serif, fontSize: 44, lineHeight: 52, fontWeight: 600 },
  heroTime: { fontSize: 22, lineHeight: 28, fontWeight: 600 },
  rakatRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.one + 2, marginTop: Spacing.three },
  rakatChip: { flexDirection: 'row', alignItems: 'baseline', gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: Spacing.two + 2 },
  rakatNum: { fontWeight: 800, fontVariant: ['tabular-nums'] },
  heroCountdown: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 253, 247, 0.16)',
  },
  card: { borderRadius: 24, borderWidth: 1, paddingVertical: Spacing.three, paddingHorizontal: Spacing.two },
  cardTitle: { letterSpacing: 1.5, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  spaced: { letterSpacing: 1.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three - 2,
    paddingHorizontal: Spacing.three,
  },
  rowNext: { borderRadius: 16, borderTopWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowRight: { flexDirection: 'row', gap: Spacing.three },
  timeCol: { width: 76, textAlign: 'right', fontVariant: ['tabular-nums'] },
  colHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  assistant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.three,
  },
  assistantText: { flex: 1, gap: Spacing.half },
  qiblaRow: { marginTop: Spacing.two },
  qiblaIcon: { fontSize: 18 },
  pill: {
    borderRadius: 999,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontWeight: 700 },
  footerBlock: { gap: Spacing.two },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingTop: Spacing.two },
  footerText: { fontStyle: 'italic' },
});
