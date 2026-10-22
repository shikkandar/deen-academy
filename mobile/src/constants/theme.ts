/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Jasmine theme: cream petals, leaf green, and the flower's golden centre.
// Dark mode is "night jasmine" — deep leaf green with cream text.
export const Colors = {
  light: {
    text: '#2E2A24',
    background: '#FBF7EE',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F2EBDC',
    textSecondary: '#8C8576',
    border: '#EDE4D1',
    primary: '#2F6B4F',
    primarySoft: '#E7F1EA',
    petalSoft: '#DCEBE1', // solid soft green for small flower badges
    onPrimary: '#FFFDF7', // text on a primary-coloured button
    hero: '#2F6B4F',
    onHero: '#FFFDF7',
    onHeroMuted: 'rgba(255, 253, 247, 0.75)',
    gold: '#E2B84F',
    petal: '#FFFFFF',
  },
  dark: {
    text: '#F3EEE2',
    background: '#0E1612',
    backgroundElement: '#16221C',
    backgroundSelected: '#1F2E26',
    textSecondary: '#A3A89C',
    border: '#24332B',
    primary: '#8FCBA5',
    primarySoft: 'rgba(143, 203, 165, 0.14)',
    petalSoft: '#243B30',
    onPrimary: '#0E1612',
    hero: '#1E3B2D',
    onHero: '#FFFDF7',
    onHeroMuted: 'rgba(255, 253, 247, 0.7)',
    gold: '#E9C46A',
    petal: '#FFFDF7',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// The web tab bar floats over the top of the page.
export const TopTabInset = Platform.select({ web: 56 }) ?? 0;
export const BottomTabInset =Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// Desktop web (see useLayout): a left sidebar replaces the top bar and pages use the extra width.
export const WideBreakpoint = 1024;
export const SidebarWidth = 248;
export const WideMaxContentWidth = 1240;
export const ReadingWidth = 900;
