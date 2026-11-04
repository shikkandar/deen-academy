/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Geometric theme: deep emerald and warm gold, with the eight-pointed star of the book covers (the Special Edition keeps
// the jasmine). `petal` / `petalSoft` colour the stars (the components keep their jasmine names).
export const Colors = {
  light: {
    text: '#18231F',
    background: '#F6F1E6',
    backgroundElement: '#FFFCF5',
    backgroundSelected: '#EEE6D6',
    textSecondary: '#5A665F',
    border: '#E2D9C6',
    primary: '#0F4A40',
    primarySoft: '#E6EFEA',
    petalSoft: '#DCE8E2', // solid soft green for small star badges
    onPrimary: '#FFFCF5', // text on a primary-coloured button
    hero: '#0F4A40',
    onHero: '#F6F1E6',
    onHeroMuted: 'rgba(246, 241, 230, 0.78)',
    gold: '#BF9748', // warm gold: brighter than dusty, not yellow
    petal: '#BF9748',
  },
  dark: {
    text: '#F1ECE0',
    background: '#0B1B19',
    backgroundElement: '#0F2421',
    backgroundSelected: '#173430',
    textSecondary: '#AFB9B2',
    border: '#22403A',
    primary: '#D8B370',
    primarySoft: 'rgba(216, 179, 112, 0.14)',
    petalSoft: '#1A3A33',
    onPrimary: '#13241F',
    hero: '#13302B',
    onHero: '#F1ECE0',
    onHeroMuted: 'rgba(241, 236, 224, 0.72)',
    gold: '#D8B370', // warm gold: brighter than dusty, not yellow
    petal: '#D8B370',
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
