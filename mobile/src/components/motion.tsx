import * as Haptics from 'expo-haptics';
import { useEffect, type ComponentProps } from 'react';
import { Platform, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { JasmineFlower } from './jasmine-flower';

// One spring feel for the whole app: quick, soft, no wobble — like macOS.
export const SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

/** Staggered "float up" entrance for the nth block on a screen. */
export function enter(index: number) {
  return FadeInDown.springify().damping(18).stiffness(140).delay(80 + index * 70);
}

function tapHaptic() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type SpringPressableProps = Omit<ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

/** A Pressable that sinks slightly under the finger and springs back, with a light haptic tick. */
export function SpringPressable({ style, pressedScale = 0.96, onPressIn, onPressOut, ...rest }: SpringPressableProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressableBase
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(pressedScale, SPRING));
        tapHaptic();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}

type FloatingFlowerProps = ComponentProps<typeof JasmineFlower> & {
  /** Seconds for one full turn. */
  period?: number;
  style?: StyleProp<ViewStyle>;
};

/** A jasmine flower that slowly turns and breathes — used as background decoration. */
export function FloatingFlower({ period = 40, style, rotate = 0, ...flower }: FloatingFlowerProps) {
  const turn = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: period * 1000, easing: Easing.linear }), -1));
    breathe.set(
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [period, turn, breathe]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate + turn.get()}deg` }, { scale: breathe.get() }],
  }));

  return (
    <Animated.View style={[style, animated]} pointerEvents="none">
      <JasmineFlower {...flower} />
    </Animated.View>
  );
}
