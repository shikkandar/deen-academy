import { View } from 'react-native';

/** The gold finial on a masjid dome — crescent, rod, ball and base — drawn with plain views, to stand on the arched
 *  next-prayer card. `cutout` is the colour behind it (it carves the crescent). */
export function MasjidFinial({ color, cutout }: { color: string; cutout: string }) {
  return (
    <View style={{ width: 28, height: 44, alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: 14, height: 14 }}>
        <View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: 4, top: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: cutout }} />
      </View>
      <View style={{ width: 2, height: 9, borderRadius: 1, backgroundColor: color }} />
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <View style={{ width: 2, height: 5, backgroundColor: color }} />
      <View style={{ width: 12, height: 9, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: color }} />
    </View>
  );
}

