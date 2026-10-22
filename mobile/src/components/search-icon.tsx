import { StyleSheet, View } from 'react-native';

/** A small magnifying glass, drawn with views (no icon font needed). */
export function SearchIcon({ size = 18, color }: { size?: number; color: string }) {
  const ring = size * 0.68;
  const stroke = Math.max(1.6, size * 0.11);
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.ring, { width: ring, height: ring, borderRadius: ring / 2, borderWidth: stroke, borderColor: color }]} />
      <View
        style={[
          styles.handle,
          { width: size * 0.38, height: stroke, borderRadius: stroke, backgroundColor: color, top: ring * 0.86, left: ring * 0.72 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', top: 0, left: 0 },
  handle: { position: 'absolute', transform: [{ rotate: '45deg' }], transformOrigin: 'left center' },
});
