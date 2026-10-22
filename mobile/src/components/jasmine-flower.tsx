import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  size?: number;
  petalColor?: string;
  centerColor?: string;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
};

/** A five-petal jasmine flower drawn with plain views. */
export function JasmineFlower({ size = 32, petalColor, centerColor, rotate = 0, style }: Props) {
  const theme = useTheme();
  const petalW = size * 0.36;
  const petalH = size * 0.5;
  const center = size * 0.2;

  return (
    <View style={[{ width: size, height: size, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {[0, 72, 144, 216, 288].map((deg) => (
        <View
          key={deg}
          style={[
            styles.abs,
            {
              width: petalW,
              height: petalH,
              left: (size - petalW) / 2,
              top: (size - petalH) / 2,
              borderRadius: petalW,
              backgroundColor: petalColor ?? theme.petal,
              transform: [{ rotate: `${deg}deg` }, { translateY: -size * 0.24 }],
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

/** A number sitting in a jasmine flower — like the ornament that marks the end of an ayah. */
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
