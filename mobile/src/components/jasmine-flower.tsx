import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  size?: number;
  petalColor?: string;
  centerColor?: string;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
};

/** An eight-pointed star (two squares, one turned 45°), the girih of the book covers, drawn with plain views.
 *  Deen Academy's ornament; it keeps the jasmine's name and props so every screen that used the flower shows the star. */
export function JasmineFlower({ size = 32, petalColor, centerColor, rotate = 0, style }: Props) {
  const theme = useTheme();
  const side = size * 0.66; // a square this size, turned 45°, just fits in `size`
  const center = size * 0.22;

  return (
    <View style={[{ width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {[0, 45].map((deg) => (
        <View
          key={deg}
          style={[
            styles.abs,
            {
              width: side,
              height: side,
              left: (size - side) / 2,
              top: (size - side) / 2,
              borderRadius: size * 0.04,
              backgroundColor: petalColor ?? theme.petal,
              transform: [{ rotate: `${deg}deg` }],
            },
          ]}
        />
      ))}
      <View
        style={[
          styles.abs,
          {
            width: center,
            height: center,
            left: (size - center) / 2,
            top: (size - center) / 2,
            borderRadius: center,
            backgroundColor: centerColor ?? theme.gold,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  badgeText: { fontWeight: 700, fontVariant: ['tabular-nums'] },
});

/** A number sitting in an eight-pointed star — like the ornament that marks the end of an ayah. */
export function JasmineBadge({ value, size = 40, active = false }: { value: number | string; size?: number; active?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <JasmineFlower
        size={size}
        petalColor={active ? theme.primary : theme.petalSoft}
        centerColor={active ? theme.primary : theme.petalSoft}
        style={styles.abs}
      />
      <Text style={[styles.badgeText, { fontSize: size * 0.3, color: active ? theme.onPrimary : theme.primary }]}>{value}</Text>
    </View>
  );
}
