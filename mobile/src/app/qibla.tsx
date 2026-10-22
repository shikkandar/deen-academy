import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QiblaCompass } from '@/components/qibla-compass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';

export default function QiblaScreen() {
  const t = useT();
  const layout = useLayout();
  // The compass sensor only runs while this tab is on screen.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const compass = <QiblaCompass active={focused} />;
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: layout.topInset + Spacing.three }]} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.title}>{t('Qibla')}</ThemedText>
          {/* Desktop: keep the compass / camera box a sensible size in the middle of the page. */}
          {layout.wide ? <View style={styles.wideBox}>{compass}</View> : compass}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: { paddingBottom: BottomTabInset + Spacing.four, gap: Spacing.two },
  title: { fontSize: 28, fontWeight: 700, textAlign: 'center', paddingTop: Spacing.three },
  wideBox: { width: '100%', maxWidth: 480, alignSelf: 'center' },
});
