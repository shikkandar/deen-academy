import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/hooks/use-t';
import { useAppState } from '@/lib/app-state';
import type { Language } from '@/lib/settings';

import { FloatingFlower, SpringPressable } from './motion';
import { ThemedText } from './themed-text';

const LANGS: { value: Language; label: string; hint: string }[] = [
  { value: 'en', label: 'English', hint: 'ஆங்கிலம்' },
  { value: 'ta', label: 'தமிழ்', hint: 'Tamil' },
];

/** English / தமிழ் side by side; picking one switches the whole app at once. */
export function LanguageChoice() {
  const theme = useTheme();
  const { settings, updateSettings } = useAppState();
  const lang = settings.language;
  return (
    <View style={styles.row}>
      {LANGS.map((l) => {
        const on = lang === l.value;
        return (
          <SpringPressable
            key={l.value}
            pressedScale={0.96}
            onPress={() => updateSettings({ language: l.value })}
            style={[styles.choice, { backgroundColor: on ? theme.primary : theme.primarySoft }]}>
            <ThemedText numberOfLines={1} style={[styles.bold, { color: on ? theme.onPrimary : theme.primary }]}>
              {l.label}
            </ThemedText>
            <ThemedText type="small" numberOfLines={1} style={{ color: on ? theme.onPrimary : theme.primary, opacity: 0.8 }}>
              {l.hint}
            </ThemedText>
          </SpringPressable>
        );
      })}
    </View>
  );
}

/** Shown once to people who already set up the app before the language was asked: pick the app's language. */
export function LanguagePrompt() {
  const theme = useTheme();
  const t = useT();
  const { updateSettings } = useAppState();
  const [open, setOpen] = useState(true);
  const done = () => {
    updateSettings({ languageAsked: true });
    setOpen(false);
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={done}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.center}>
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Animated.View entering={FadeIn.duration(800)} style={[styles.flowerWrap, { backgroundColor: theme.primarySoft }]}>
              <FloatingFlower size={40} period={24} />
            </Animated.View>
            <ThemedText style={styles.title}>{t('Choose your language')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {t('The whole app will be shown in this language. You can change it any time in Settings.')}
            </ThemedText>
            <LanguageChoice />
            <SpringPressable onPress={done} style={[styles.button, { backgroundColor: theme.primary }]}>
              <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t('Continue')}</ThemedText>
            </SpringPressable>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  choice: { flex: 1, minWidth: 0, borderRadius: 18, paddingVertical: Spacing.two, alignItems: 'center' },
  bold: { fontWeight: 700 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  centerText: { textAlign: 'center' },
  card: { width: '100%', maxWidth: 420, borderRadius: 28, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  flowerWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: 700, textAlign: 'center', marginTop: Spacing.two },
  button: { borderRadius: 999, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
});
