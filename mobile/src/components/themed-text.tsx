import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppLanguage } from '@/lib/app-state';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const lang = useAppLanguage();
  const base = [{ color: theme[themeColor ?? 'text'] }, styles[type], style];
  return <Text style={lang === 'ta' ? tamil(base) : base} {...rest} />;
}

/**
 * Tamil needs room the English styles don't give it: letter spacing pulls the vowel signs off their letters (the
 * spaced-out UPPERCASE labels), and English line heights clip the signs above and below the line.
 */
function tamil(style: TextProps['style']) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = flat.fontSize ?? 16;
  const minLine = Math.ceil(fontSize * 1.4);
  return {
    ...flat,
    letterSpacing: 0,
    ...(flat.lineHeight != null && flat.lineHeight < minLine ? { lineHeight: minLine } : null),
  };
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
