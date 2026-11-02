import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import type { Step } from '@/lib/salah-sequence';
import type { Gender } from '@/lib/settings';

/** The postures the praying man takes, as held in the video. */
export type Figure = 'qawmah' | 'takbir' | 'qiyam' | 'ruku' | 'sujood' | 'jalsa' | 'salamR' | 'salamL' | 'dua';

// The same prayer, the same timings: a man, or a woman in the women's postures (Hanafi).
const VIDEO = {
  male: { light: require('@/assets/salah/salah-light.mp4'), dark: require('@/assets/salah/salah-dark.mp4') },
  female: { light: require('@/assets/salah/salah-female-light.mp4'), dark: require('@/assets/salah/salah-female-dark.mp4') },
};
const FPS = 30;
// The video is a 720 px square; on screen it is at most SIZE points square, smaller on a narrow screen so the
// widest posture (HALF px either side of its middle) still fits.
const SIZE = 260;
const HALF = 200;
// The middle of each posture in the video (x, px), kept in the middle of the screen: standing, sitting (one for
// every standing or sitting posture, so raising the hands never moves the body), ruku and sajdah. The video slides
// from one to the next while he or she moves.
const MIDDLE: Record<Gender, { stand: number; sit: number; ruku: number; sujood: number }> = {
  male: { stand: 196, sit: 250, ruku: 322, sujood: 399 },
  female: { stand: 216, sit: 258, ruku: 339, sujood: 416 },
};
const GROUP: Record<Figure, 'stand' | 'sit' | 'ruku' | 'sujood'> = {
  qawmah: 'stand', takbir: 'stand', qiyam: 'stand', ruku: 'ruku', sujood: 'sujood',
  jalsa: 'sit', salamR: 'sit', salamL: 'sit', dua: 'sit',
};
// How far in from each edge of the video the picture is faded into the page (px of the video): his body never
// comes nearer the edges than this, and the video's background never shows a box edge against the page's.
const FADE = { left: 110, right: 110, top: 26, bottom: 44 };
// On a narrow screen the video runs past the sides of the screen: faded there too.
const EDGE = 24;

function sizeFor(width: number) {
  if (!width) return SIZE;
  return Math.min(SIZE, ((width / 2 - 8) / HALF) * 720);
}
// Where each movement lies in the video (first frame, frame count), from its segments.json; every movement is
// followed in the video by its posture held still.
const MOVES: Record<string, [number, number]> = {
  'qawmah-takbir': [24, 28],
  'takbir-qiyam': [82, 31],
  'qiyam-ruku': [878, 52],
  'ruku-qawmah': [984, 49],
  'qawmah-sujood': [1069, 73],
  'sujood-jalsa': [1408, 61],
  'jalsa-sujood': [1293, 61],
  'sujood-qiyam': [718, 85],
  'jalsa-salamR': [1547, 31],
  'salamR-jalsa': [1608, 31],
  'jalsa-salamL': [1661, 31],
  'salamL-jalsa': [1722, 31],
  'jalsa-dua': [1768, 46],
};
// A frame of each posture held still.
const REST: Record<Figure, number> = {
  qawmah: 0, takbir: 51, qiyam: 112, ruku: 239, sujood: 451, jalsa: 566, salamR: 1577, salamL: 1691, dua: 1813,
};

/** The posture for a step of the prayer. */
export function figureFor(step: Step | undefined): Figure {
  if (!step) return 'qawmah';
  if (step.key.startsWith('iqamah')) return 'qawmah';
  if (step.title === 'Takbir al-Ihram') return 'takbir';
  if (step.title === 'Salam · to the right') return 'salamR';
  if (step.title === 'Salam · to the left') return 'salamL';
  if (step.key === 'sami' || step.key === 'rabbana') return 'qawmah';
  switch (step.posture) {
    case 'ruku':
      return 'ruku';
    case 'sujood':
      return 'sujood';
    case 'sitting':
      return 'jalsa';
    case 'dua':
      return 'dua';
    default:
      return 'qiyam';
  }
}

/** The stretch of the video (seconds) that goes from one posture to another, or null to cut straight to it. */
function stretch(from: Figure, to: Figure): [number, number] | null {
  const span = (a: string, b: string) => {
    const m = MOVES[a] ?? null;
    const n = MOVES[b] ?? m;
    return m && n && n[0] >= m[0] ? ([m[0], n[0] + n[1] - 1] as const) : null;
  };
  // Direct, or through the sitting posture (from one Salam to the other, or to the dua), played straight through
  // with the pause the video holds between them.
  const s = span(`${from}-${to}`, `${from}-${to}`) ?? span(`${from}-jalsa`, `jalsa-${to}`);
  return s ? [(s[0] + 0.5) / FPS, (s[1] + 0.5) / FPS] : null;
}

// The player is changed only from these helpers (outside the component), as the React Compiler requires.
function setUp(p: VideoPlayer) {
  p.muted = true;
  p.timeUpdateEventInterval = 1 / FPS;
}

function holdAt(p: VideoPlayer, seconds: number) {
  p.pause();
  p.currentTime = seconds;
}

function playFrom(p: VideoPlayer, seconds: number) {
  p.currentTime = seconds;
  p.play();
}

function setSpeed(p: VideoPlayer, speed: number) {
  p.playbackRate = speed;
}

/**
 * The one praying (faceless, side view) moving with the imam: each new step plays the movement into its posture,
 * at the recitation's speed, then holds it. Drawn on the theme's own background colour.
 */
export function SalahFigure({ figure, speed, gender = 'male' }: { figure: Figure; speed: number; gender?: Gender }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useTheme();
  const player = useVideoPlayer(VIDEO[gender][scheme], setUp);
  const shown = useRef<Figure>('qawmah');
  const middle = useSharedValue(MIDDLE[gender][GROUP.qawmah]);
  const stopAt = useRef<number | null>(null);
  // The frame shown while he holds the posture.
  const still = useRef((REST.qawmah + 0.5) / FPS);

  useEffect(() => {
    const from = shown.current;
    // A new speed alone changes nothing here (the player's rate is set below).
    if (from === figure && stopAt.current != null) return;
    shown.current = figure;
    const s = from === figure ? null : stretch(from, figure);
    const to = MIDDLE[gender][GROUP[figure]];
    middle.set(s ? withTiming(to, { duration: ((s[1] - s[0]) * 1000) / speed, easing: Easing.inOut(Easing.ease) }) : to);
    if (s) {
      stopAt.current = s[1];
      playFrom(player, s[0]);
    } else {
      stopAt.current = null;
      still.current = (REST[figure] + 0.5) / FPS;
      holdAt(player, still.current);
    }
  }, [player, figure, gender, middle, speed]);

  useEffect(() => {
    setSpeed(player, speed);
  }, [player, speed]);

  // Hold the posture where its movement ends; after a theme change, show it again.
  useEffect(() => {
    const time = player.addListener('timeUpdate', ({ currentTime }) => {
      if (stopAt.current != null && currentTime >= stopAt.current) {
        still.current = stopAt.current;
        stopAt.current = null;
        holdAt(player, still.current);
      } else if (stopAt.current == null && Math.abs(currentTime - still.current) > 1 / FPS) {
        // Not moving (the web player can start by itself, or a seek made before it loaded is lost): back to the
        // posture.
        holdAt(player, still.current);
      }
    });
    const load = player.addListener('sourceLoad', () => {
      stopAt.current = null;
      holdAt(player, still.current);
    });
    return () => {
      time.remove();
      load.remove();
    };
  }, [player]);

  const [width, setWidth] = useState(0);
  const size = sizeFor(width);
  const k = size / 720;
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: -middle.get() * k }] }));
  const bg = theme.background;
  const clear = `${bg}00`;
  return (
    <View style={[styles.stage, { height: size }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.box, { width: size, height: size }, slide]}>
        <VideoView player={player} style={[styles.video, { width: size, height: size }]} contentFit="contain" nativeControls={false} />
        <LinearGradient colors={[bg, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.left, { width: FADE.left * k }]} />
        <LinearGradient colors={[clear, bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.right, { width: FADE.right * k }]} />
        <LinearGradient colors={[bg, clear]} style={[styles.fade, styles.top, { height: FADE.top * k }]} />
        <LinearGradient colors={[clear, bg]} style={[styles.fade, styles.bottom, { height: FADE.bottom * k }]} />
      </Animated.View>
      <LinearGradient colors={[bg, clear]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.left, { width: EDGE }]} />
      <LinearGradient colors={[clear, bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.right, { width: EDGE }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'stretch', overflow: 'hidden' },
  box: { position: 'absolute', top: 0, left: '50%' },
  video: { position: 'absolute', top: 0, left: 0 },
  fade: { position: 'absolute' },
  left: { left: 0, top: 0, bottom: 0 },
  right: { right: 0, top: 0, bottom: 0 },
  top: { top: 0, left: 0, right: 0 },
  bottom: { bottom: 0, left: 0, right: 0 },
});
