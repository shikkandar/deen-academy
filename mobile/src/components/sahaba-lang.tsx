import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { LANG_LABEL, type SLang } from '@/lib/sahaba';

import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

/** Tamil (ours) / Arabic original / English / printed Tamil switch for Hayatus Sahaba. */
export function SahabaLangSwitch({ value, onChange }: { value: SLang; onChange: (lang: SLang) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {(['ta', 'ar', 'en', 'tp'] as const).map((id) => {
        const on = value === id;
        return (
          <SpringPressable
            key={id}
            pressedScale={0.95}
            onPress={() => onChange(id)}
            style={[styles.btn, on && { backgroundColor: theme.primary }]}>
            <ThemedText type="small" style={[styles.bold, { color: on ? theme.onPrimary : theme.textSecondary }]}>
              {LANG_LABEL[id]}
            </ThemedText>
          </SpringPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 3, gap: 2 },
  btn: { borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8 },
  bold: { fontWeight: 700 },
});
