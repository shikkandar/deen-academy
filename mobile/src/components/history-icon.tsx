import { StyleSheet, View } from 'react-native';

/** A small clock (recently read), drawn with views like the search icon (no icon font needed). */
export function HistoryIcon({ size = 18, color }: { size?: number; color: string }) {
  const stroke = Math.max(1.6, size * 0.11);
  const centre = size / 2;
  const hand = (length: number, angle: number) => (
    <View
      style={[
        styles.hand,
        {
          width: length,
          height: stroke,
          borderRadius: stroke,
          backgroundColor: color,
          top: centre - stroke / 2,
          left: centre - stroke / 2,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.face, { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: color }]} />
      {hand(size * 0.32, -90)}
      {hand(size * 0.26, 0)}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', top: 0, left: 0 },
  hand: { position: 'absolute', transformOrigin: `left center` },
});
