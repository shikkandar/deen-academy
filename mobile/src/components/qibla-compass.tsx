import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { useLookHeading } from '@/lib/heading';
import { angleDiff, compassPoint, distanceToKaaba, qiblaBearing } from '@/lib/qibla';

import { SpringPressable } from './motion';
import { ThemedText } from './themed-text';

const SIZE = 280;
const ON_TARGET = 4; // degrees either side that count as facing the Qibla

type Mode = 'camera' | 'compass';

/**
 * Finds the Qibla two ways: through the camera (an arrow over the live view turns you toward the Kaaba) or as a
 * compass dial held flat. It buzzes once you face it. Sensors and camera only run while `active`.
 */
export function QiblaCompass({ active }: { active: boolean }) {
  const theme = useTheme();
  const t = useT();
  const { place } = useAppState();
  const [mode, setMode] = useState<Mode>(Platform.OS === 'web' ? 'compass' : 'camera');
  const [permission, requestPermission] = useCameraPermissions();
  const look = useLookHeading(active);
  const rotation = useSharedValue(0); // dial turn, accumulated so it never spins the long way round
  const arrow = useSharedValue(0);
  const facingRef = useRef(false);

  const qibla = place ? qiblaBearing(place) : null;
  const heading = look?.degrees ?? null;
  const diff = heading != null && qibla != null ? angleDiff(qibla, heading) : null;
  const facing = diff != null && Math.abs(diff) <= ON_TARGET;

  // Open the camera straight away the first time.
  useEffect(() => {
    if (active && mode === 'camera' && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [active, mode, permission, requestPermission]);

  useEffect(() => {
    if (heading == null) return;
    rotation.value = withTiming(rotation.value + angleDiff(-heading, rotation.value), { duration: 150 });
    if (diff != null) arrow.value = withTiming(arrow.value + angleDiff(diff, arrow.value), { duration: 150 });
  }, [heading, diff, rotation, arrow]);

  // A gentle buzz the moment you turn to face the Qibla.
  useEffect(() => {
    if (facing && !facingRef.current) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    facingRef.current = facing;
  }, [facing]);

  const dial = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  const pointer = useAnimatedStyle(() => ({ transform: [{ rotate: `${arrow.value}deg` }] }));

  if (!place || qibla == null) {
    return <ThemedText style={styles.center}>{t('Turn on location so the Qibla can be worked out for where you are.')}</ThemedText>;
  }

  const status =
    heading == null
      ? Platform.OS === 'web'
        ? t('Qibla is {deg}° from North', { deg: Math.round(qibla) })
        : t('Finding north…')
      : facing
        ? t('You are facing the Qibla')
        : t(diff! > 0 ? 'Turn right {deg}°' : 'Turn left {deg}°', { deg: Math.abs(Math.round(diff!)) });
  const cameraReady = mode === 'camera' && permission?.granted;

  return (
    <View style={styles.body}>
      {Platform.OS !== 'web' && (
        <View style={[styles.segment, { backgroundColor: theme.primarySoft }]}>
          {(
            [
              ['camera', '📷  Camera'],
              ['compass', '🧭  Compass'],
            ] as const
          ).map(([m, label]) => (
            <SpringPressable
              key={m}
              pressedScale={0.95}
              onPress={() => setMode(m)}
              style={[styles.segmentItem, mode === m && { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={[styles.bold, { color: mode === m ? theme.onPrimary : theme.primary }]}>
                {t(label)}
              </ThemedText>
            </SpringPressable>
          ))}
        </View>
      )}

      <ThemedText style={[styles.status, { color: facing ? theme.primary : theme.text }]}>{status}</ThemedText>

      {mode === 'camera' && !cameraReady && (
        <SpringPressable onPress={requestPermission} style={[styles.notice, { backgroundColor: theme.primarySoft }]}>
          <ThemedText type="small" style={{ color: theme.primary }}>
            {t('Allow the camera to find the Qibla through it →')}
          </ThemedText>
        </SpringPressable>
      )}

      {cameraReady && (
        <View style={[styles.cameraBox, { borderColor: facing ? theme.primary : theme.border }]}>
          {active && <CameraView style={StyleSheet.absoluteFill} facing="back" />}
          <View style={styles.overlay} pointerEvents="none">
            {facing ? (
              <View style={[styles.kaabaBadge, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                <ThemedText style={styles.kaabaBig}>🕋</ThemedText>
                <ThemedText style={styles.overlayText}>{t('Qibla')}</ThemedText>
              </View>
            ) : (
              <Animated.View style={[styles.arrowWrap, pointer]}>
                <ThemedText style={styles.arrow}>⬆</ThemedText>
              </Animated.View>
            )}
            {look && !look.upright && (
              <ThemedText style={[styles.overlayText, styles.tip]}>{t('Hold the phone up and look through the camera')}</ThemedText>
            )}
          </View>
        </View>
      )}

      {mode === 'compass' && (
        <View style={styles.compass}>
          {/* fixed pointer: where the top of the phone points */}
          <View style={[styles.pointer, { borderBottomColor: facing ? theme.primary : theme.textSecondary }]} />
          <Animated.View
            style={[styles.dial, dial, { borderColor: facing ? theme.primary : theme.border, backgroundColor: theme.backgroundElement }]}>
            {(['N', 'E', 'S', 'W'] as const).map((d, i) => (
              <View key={d} style={[styles.mark, { transform: [{ rotate: `${i * 90}deg` }] }]}>
                <ThemedText style={[styles.bold, { color: d === 'N' ? theme.primary : theme.textSecondary }]}>{d}</ThemedText>
              </View>
            ))}
            <View style={[styles.mark, { transform: [{ rotate: `${qibla}deg` }] }]}>
              <ThemedText style={styles.kaaba}>🕋</ThemedText>
              <View style={[styles.needle, { backgroundColor: theme.primary }]} />
            </View>
          </Animated.View>
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {t('Qibla {deg}° {point} · Makkah is {km} km away', {
          deg: Math.round(qibla),
          point: compassPoint(qibla),
          km: Math.round(distanceToKaaba(place)).toLocaleString(),
        })}
      </ThemedText>
      {look?.needsCalibration && (
        <ThemedText type="small" style={[styles.center, { color: theme.primary }]}>
          {t('Compass needs calibrating: move the phone in a figure 8 a few times, away from metal and magnets.')}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {t(mode === 'camera' ? 'Hold the phone upright and turn until the Kaaba appears.' : 'Hold the phone flat, top pointing ahead.')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: 700 },
  body: { alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  status: { fontSize: 22, fontWeight: 700, textAlign: 'center' },
  center: { textAlign: 'center', paddingHorizontal: Spacing.three },
  notice: { borderRadius: 16, padding: Spacing.three },
  segment: { flexDirection: 'row', borderRadius: 999, padding: Spacing.one },
  segmentItem: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, borderRadius: 24, borderWidth: 3, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  arrowWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 120, lineHeight: 140, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  kaabaBadge: { alignItems: 'center', borderRadius: 32, padding: Spacing.four },
  kaabaBig: { fontSize: 96, lineHeight: 110 },
  overlayText: { color: '#FFFFFF', fontWeight: 700, textAlign: 'center' },
  tip: { position: 'absolute', bottom: Spacing.four, paddingHorizontal: Spacing.four },
  compass: { width: SIZE, height: SIZE + 24, alignItems: 'center' },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: 4,
  },
  dial: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3 },
  // a full-size layer rotated to the mark's angle, with the mark at its top
  mark: { position: 'absolute', top: 0, left: 0, width: SIZE, height: SIZE, alignItems: 'center', paddingTop: Spacing.two },
  kaaba: { fontSize: 30 },
  needle: { width: 3, height: SIZE / 2 - 56, borderRadius: 2 },
});
