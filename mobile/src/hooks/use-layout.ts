import { Platform, useWindowDimensions, type DimensionValue, type ViewStyle } from 'react-native';

import { MaxContentWidth, ReadingWidth, SidebarWidth, Spacing, TopTabInset, WideBreakpoint, WideMaxContentWidth } from '@/constants/theme';

export type Layout = {
  /** Desktop web: sidebar navigation and multi-column pages. Never true on iOS / Android. */
  wide: boolean;
  /** Grid columns for card lists: 1 on phones and narrow windows, 2–3 on desktop. */
  columns: 1 | 2 | 3;
  /** Top padding a screen needs for the navigation (the floating web top bar; 0 under the sidebar). */
  topInset: number;
  /** Max width of a page's content column. */
  maxWidth: number;
  /** Max width for reading screens (surah, chapter, Qibla …). */
  readingWidth: number;
};

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= WideBreakpoint;
  if (!wide) return { wide, columns: 1, topInset: TopTabInset, maxWidth: MaxContentWidth, readingWidth: MaxContentWidth };
  const content = Math.min(width - SidebarWidth, WideMaxContentWidth);
  return {
    wide,
    columns: content >= 1100 ? 3 : 2,
    topInset: Spacing.three,
    maxWidth: WideMaxContentWidth,
    readingWidth: ReadingWidth,
  };
}

/** One cell of a FlatList grid (`numColumns`): equal widths, and a lone last item doesn't stretch. */
export function gridItemStyle(columns: number, gap: number): ViewStyle | undefined {
  if (columns <= 1) return undefined;
  return { flex: 1, maxWidth: `calc((100% - ${gap * (columns - 1)}px) / ${columns})` as DimensionValue };
}
