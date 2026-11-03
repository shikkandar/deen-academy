import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import type { Gender, Profile } from '@/lib/settings';

import { LanguageChoice } from './language-choice';
import { FloatingFlower, SpringPressable } from './motion';
import { ThemedText } from './themed-text';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

/** The date typed as day, month and year, as "YYYY-MM-DD", or null when it is not a real past date. */
function dateOf(day: string, month: string, year: string) {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!d || !m || year.length !== 4 || y < 1900) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date > new Date()) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function ageOf(dob: string) {
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
}

/**
 * Asked once, the first time the app opens: the app's language, name, gender and date of birth (the age follows from it). The Namaz
 * Assistant then shows a man or a woman praying. From Settings the same card edits them (`initial` filled in, with
 * Cancel).
 */
export function ProfileSetup({ initial, onClose }: { initial?: Profile | null; onClose?: () => void }) {
  const theme = useTheme();
  const t = useT();
  const { updateSettings } = useAppState();
  const [y0, m0, d0] = initial?.dob.split('-') ?? ['', '', ''];
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<Gender | null>(initial?.gender ?? null);
  const [day, setDay] = useState(d0);
  const [month, setMonth] = useState(m0);
  const [year, setYear] = useState(y0);
  const dob = dateOf(day, month, year);
  const ready = name.trim().length > 0 && gender != null && dob != null;
  const typed = (s: string) => s.replace(/[^0-9]/g, '');

  const field = [styles.input, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.center} keyboardShouldPersistTaps="handled">
          <Animated.View
            entering={FadeInDown.springify().damping(18)}
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Animated.View entering={FadeIn.duration(800)} style={[styles.flowerWrap, { backgroundColor: theme.primarySoft }]}>
              <FloatingFlower size={40} period={24} />
            </Animated.View>
            <ThemedText style={styles.title}>{t(initial ? 'Your details' : 'Assalamu alaikum')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {t('A little about you, so we can greet you by name and show a brother or a sister praying in the Namaz Assistant.')}
            </ThemedText>

            {!initial && (
              <>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
                  {t('LANGUAGE')}
                </ThemedText>
                <LanguageChoice />
              </>
            )}

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {t('YOUR NAME')}
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('Name')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoComplete="name"
              style={field}
            />

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {t('GENDER')}
            </ThemedText>
            <View style={styles.row}>
              {GENDERS.map((g) => {
                const on = gender === g.value;
                return (
                  <SpringPressable
                    key={g.value}
                    pressedScale={0.96}
                    onPress={() => setGender(g.value)}
                    style={[styles.choice, { backgroundColor: on ? theme.primary : theme.primarySoft }]}>
                    <ThemedText style={[styles.bold, { color: on ? theme.onPrimary : theme.primary }]}>{t(g.label)}</ThemedText>
                  </SpringPressable>
                );
              })}
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
              {t('DATE OF BIRTH')}
            </ThemedText>
            <View style={styles.row}>
              <TextInput
                value={day}
                onChangeText={(s) => setDay(typed(s).slice(0, 2))}
                placeholder={t('DD')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[field, styles.short]}
              />
              <TextInput
                value={month}
                onChangeText={(s) => setMonth(typed(s).slice(0, 2))}
                placeholder={t('MM')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[field, styles.short]}
              />
              <TextInput
                value={year}
                onChangeText={(s) => setYear(typed(s).slice(0, 4))}
                placeholder={t('YYYY')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[field, styles.long]}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {dob ? t('Age {n}', { n: ageOf(dob) }) : ' '}
            </ThemedText>

            <SpringPressable
              disabled={!ready}
              onPress={() => {
                if (!ready) return;
                updateSettings({ profile: { name: name.trim(), gender: gender!, dob: dob! }, ...(initial ? null : { languageAsked: true }) });
                onClose?.();
              }}
              style={[styles.button, { backgroundColor: theme.primary, opacity: ready ? 1 : 0.4 }]}>
              <ThemedText style={[styles.bold, { color: theme.onPrimary }]}>{t(initial ? 'Save' : 'Continue')}</ThemedText>
            </SpringPressable>
            {onClose && (
              <SpringPressable onPress={onClose} style={styles.cancel}>
                <ThemedText type="small" style={[styles.bold, { color: theme.primary }]}>
                  {t('Cancel')}
                </ThemedText>
              </SpringPressable>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.three },
  centerText: { textAlign: 'center' },
  card: { width: '100%', maxWidth: 420, borderRadius: 28, borderWidth: 1, padding: Spacing.four, gap: Spacing.two },
  flowerWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: 700, textAlign: 'center', marginTop: Spacing.two },
  label: { letterSpacing: 1.5, marginTop: Spacing.two },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + Spacing.one, fontSize: 16 },
  row: { flexDirection: 'row', gap: Spacing.two },
  choice: { flex: 1, borderRadius: 999, paddingVertical: Spacing.two + Spacing.one, alignItems: 'center' },
  short: { flex: 1, width: 0, minWidth: 0, textAlign: 'center' },
  long: { flex: 1.6, width: 0, minWidth: 0, textAlign: 'center' },
  bold: { fontWeight: 700 },
  button: { borderRadius: 999, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.three },
  cancel: { alignSelf: 'center', padding: Spacing.two },
});
