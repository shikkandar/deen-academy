import { StyleSheet, View } from 'react-native';

import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import type { MLang } from '@/lib/muntakhab';

import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

/** Tamil / English switch for Muntakhab Ahadith. */
export function MuntakhabLangSwitch({ value, onChange }: { value: MLang; onChange: (lang: MLang) => void }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {(
        [
          ['ta', 'Tamil'],
          ['en', 'English'],
        ] as const
      ).map(([id, label]) => {
        const on = value === id;
        return (
          <SpringPressable
            key={id}
            pressedScale={0.95}
            onPress={() => onChange(id)}
            style={[styles.btn, on && { backgroundColor: theme.primary }]}>
            <ThemedText type="small" style={[styles.bold, { color: on ? theme.onPrimary : theme.textSecondary }]}>
              {t(label)}
            </ThemedText>
          </SpringPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, gap: 2 },
  btn: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  bold: { fontWeight: 700 },
});
