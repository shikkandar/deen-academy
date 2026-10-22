import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState, Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Spacing } from '@/constants/theme';
import { pick, reminderForToday, WELCOME } from '@/constants/content';
import { useT } from '@/hooks/use-t';
import { useAppState } from '@/lib/app-state';
import { useTheme } from '@/hooks/use-theme';

import { FloatingFlower, SpringPressable } from './motion';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** The welcome note — shown on first open, and from Settings any time. */
export function WelcomeNote({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const t = useT();
  const lang = useAppState().settings.language;
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeIn.duration(900)} style={[styles.flowerWrap, { backgroundColor: theme.primarySoft }]}>
              <FloatingFlower size={64} period={24} />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).springify().damping(18)}>
              <ThemedText style={styles.title}>{pick(WELCOME.title, lang)}</ThemedText>
            </Animated.View>

            {WELCOME.paragraphs.map((p, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(500 + i * 350).springify().damping(18)}>
                <ThemedText style={styles.paragraph}>{pick(p, lang)}</ThemedText>
              </Animated.View>
            ))}

            <Animated.View
              entering={FadeInDown.delay(500 + WELCOME.paragraphs.length * 350).springify().damping(18)}
              style={[styles.dua, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText style={[styles.duaArabic, { color: theme.primary }]}>{WELCOME.dua.arabic}</ThemedText>
              <View style={[styles.divider, { backgroundColor: theme.gold }]} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.duaEnglish}>
                {pick(WELCOME.dua.meaning, lang)}
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(900 + WELCOME.paragraphs.length * 350).duration(700)}>
              <ThemedText style={styles.signoff}>{pick(WELCOME.signoff, lang)}</ThemedText>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(1300 + WELCOME.paragraphs.length * 350).duration(600)}>
              <SpringPressable onPress={onClose} style={[styles.button, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('Bismillah')}</ThemedText>
              </SpringPressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  scroll: { padding: Spacing.four, paddingTop: Spacing.six, gap: Spacing.four, maxWidth: 560, alignSelf: 'center', width: '100%' },
  flowerWrap: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontFamily: Fonts?.serif, fontSize: 30, lineHeight: 38, fontWeight: 600, textAlign: 'center' },
  paragraph: { fontFamily: Fonts?.serif, fontSize: 18, lineHeight: 29, textAlign: 'center' },
  dua: { borderWidth: 1, borderRadius: 24, padding: Spacing.four, gap: Spacing.three },
  duaArabic: { fontSize: 22, lineHeight: 42, textAlign: 'center', writingDirection: 'rtl' },
  divider: { height: 1.5, width: 36, borderRadius: 1, opacity: 0.7, alignSelf: 'center' },
  duaEnglish: { textAlign: 'center', fontStyle: 'italic', lineHeight: 21 },
  signoff: { fontFamily: Fonts?.serif, fontSize: 17, lineHeight: 27, textAlign: 'center', fontStyle: 'italic' },
  button: { alignSelf: 'center', borderRadius: 999, paddingVertical: Spacing.three, paddingHorizontal: Spacing.six },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  noteCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 28, padding: Spacing.four, gap: Spacing.three, alignItems: 'center' },
  noteFlower: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  noteLabel: { letterSpacing: 1.2, fontSize: 11 },
  noteText: { fontFamily: Fonts?.serif, fontSize: 18, lineHeight: 28, textAlign: 'center' },
  noteButton: { borderRadius: 999, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.five },
});

const SEEN_KEY = 'welcome.seen.v1';

const NOTE_KEY = 'reminder.day.v1';
const todayKey = () => new Date().toDateString();

/** Today's reminder — a small card, once a day, the first time the app is opened. */
function DailyReminder({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const t = useT();
  const lang = useAppState().settings.language;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={[styles.noteCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.noteFlower, { backgroundColor: theme.primarySoft }]}>
            <FloatingFlower size={34} period={24} />
          </View>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.noteLabel}>
            {t("TODAY'S REMINDER")}
          </ThemedText>
          <ThemedText style={styles.noteText}>{reminderForToday(lang)}</ThemedText>
          <SpringPressable onPress={onClose} style={[styles.noteButton, { backgroundColor: theme.primary }]}>
            <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('Ameen')} 🤍</ThemedText>
          </SpringPressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** The welcome note the very first time; after that, one reminder a day on the first open of the day. */
export function FirstOpenWelcome() {
  const [show, setShow] = useState<'letter' | 'note' | null>(null);
  useEffect(() => {
    const check = () =>
      AsyncStorage.multiGet([SEEN_KEY, NOTE_KEY])
        .then(([[, seen], [, noteDay]]) => {
          if (!seen) setShow('letter');
          else if (noteDay !== todayKey()) setShow('note');
        })
        .catch(() => {});
    check();
    // Also when the app comes back to the foreground on a new day (or from the morning reminder).
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => sub.remove();
  }, []);
  const close = () => {
    setShow(null);
    // The welcome note counts as today's reminder, so two don't show in a row.
    AsyncStorage.multiSet([
      [SEEN_KEY, '1'],
      [NOTE_KEY, todayKey()],
    ]).catch(() => {});
  };
  return (
    <>
      <WelcomeNote visible={show === 'letter'} onClose={close} />
      <DailyReminder visible={show === 'note'} onClose={close} />
    </>
  );
}
