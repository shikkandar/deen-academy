import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Image, Pressable, View, StyleSheet, useWindowDimensions, type ImageSourcePropType } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  const t = useT();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{t('Prayers')}</TabButton>
          </TabTrigger>
          <TabTrigger name="quran" href="/quran" asChild>
            <TabButton>{t('Quran')}</TabButton>
          </TabTrigger>
          <TabTrigger name="qibla" href="/qibla" asChild>
            <TabButton>{t('Qibla')}</TabButton>
          </TabTrigger>
          <TabTrigger name="hadith" href="/hadith" asChild>
            <TabButton>{t('Hadith')}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon={require('@/assets/images/tabIcons/settings.png')} label={t('Settings')} />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

/** A text tab, or an icon-only tab when `icon` is given (`label` is then read by screen readers). */
export function TabButton({
  children,
  isFocused,
  icon,
  label,
  ...props
}: TabTriggerSlotProps & { icon?: ImageSourcePropType; label?: string }) {
  const theme = useTheme();
  return (
    <Pressable {...props} accessibilityLabel={label} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, icon ? styles.iconButton : null]}>
        {icon ? (
          <Image source={icon} style={[styles.icon, { tintColor: isFocused ? theme.text : theme.textSecondary }]} />
        ) : (
          <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
            {children}
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width } = useWindowDimensions();
  return (
    // Solid, edge-to-edge bar pinned to the top so content scrolls under it cleanly.
    <ThemedView {...props} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        {/* No room for the title next to four tabs on a phone-width window. */}
        {width >= 480 ? (
          <ThemedText type="smallBold" style={styles.brandText}>
            Deen Academy
          </ThemedText>
        ) : (
          <View style={styles.brandText} />
        )}

        {props.children}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    boxShadow: '0 1px 0 rgba(127, 127, 127, 0.18)',
  },
  innerContainer: {
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  iconButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one + 2 },
  icon: { width: 18, height: 18 },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
