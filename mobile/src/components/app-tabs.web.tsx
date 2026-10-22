import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { useState, type ComponentProps } from 'react';
import { Image, Linking, Pressable, View, StyleSheet, useWindowDimensions, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

import { ANDROID_APK_URL, ANDROID_APP_VERSION } from '@/constants/app';
import { MaxContentWidth, SidebarWidth, Spacing } from '@/constants/theme';
import { useLayout } from '@/hooks/use-layout';
import { useT } from '@/hooks/use-t';
import { useTheme } from '@/hooks/use-theme';

import { JasmineFlower } from './jasmine-flower';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

const ICONS = {
  home: require('@/assets/images/tabIcons/home.png'),
  quran: require('@/assets/images/tabIcons/quran.png'),
  qibla: require('@/assets/images/tabIcons/qibla.png'),
  hadith: require('@/assets/images/tabIcons/hadith.png'),
  settings: require('@/assets/images/tabIcons/settings.png'),
};

export default function AppTabs() {
  const t = useT();
  const { wide } = useLayout();

  // Desktop: a fixed sidebar on the left and the page to its right.
  if (wide) {
    return (
      <Tabs style={styles.wideRoot}>
        <TabList asChild>
          <Sidebar>
            <TabTrigger name="home" href="/" asChild>
              <SidebarItem icon={ICONS.home} label={t('Prayers')} />
            </TabTrigger>
            <TabTrigger name="quran" href="/quran" asChild>
              <SidebarItem icon={ICONS.quran} label={t('Quran')} />
            </TabTrigger>
            <TabTrigger name="qibla" href="/qibla" asChild>
              <SidebarItem icon={ICONS.qibla} label={t('Qibla')} />
            </TabTrigger>
            <TabTrigger name="hadith" href="/hadith" asChild>
              <SidebarItem icon={ICONS.hadith} label={t('Hadith')} />
            </TabTrigger>
            <TabTrigger name="settings" href="/settings" asChild>
              <SidebarItem icon={ICONS.settings} label={t('Settings')} />
            </TabTrigger>
          </Sidebar>
        </TabList>
        <TabSlot style={styles.wideSlot} />
      </Tabs>
    );
  }

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
            <TabButton icon={ICONS.settings} label={t('Settings')} />
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type ButtonProps = TabTriggerSlotProps & { icon?: ImageSourcePropType; label?: string };

/**
 * A text tab, or an icon-only tab when `icon` is given (`label` is then read by screen readers).
 * `ref` is left out: the trigger's ref type doesn't fit Pressable's, and nothing here needs it.
 */
export function TabButton({ children, isFocused, icon, label, ref: _ref, ...props }: ButtonProps) {
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

/** Desktop sidebar: the app name, the five sections, and the Android download at the bottom. */
function Sidebar({ children, style: _style, ...props }: TabListProps) {
  const theme = useTheme();
  const t = useT();
  return (
    <ThemedView {...props} style={[styles.sidebar, { borderRightColor: theme.border }]}>
      <View style={styles.brand}>
        <View style={[styles.brandFlower, { backgroundColor: theme.primarySoft }]}>
          <JasmineFlower size={26} />
        </View>
        <ThemedText style={styles.brandName}>Deen Academy</ThemedText>
      </View>
      <View style={styles.nav}>{children}</View>
      {!!ANDROID_APK_URL && (
        <View style={[styles.download, { backgroundColor: theme.primarySoft }]}>
          <HoverPressable
            onPress={() => Linking.openURL(ANDROID_APK_URL)}
            style={(hovered) => [styles.downloadBtn, { backgroundColor: theme.primary, opacity: hovered ? 0.88 : 1 }]}>
            <ThemedText type="small" style={[styles.bold, { color: theme.onPrimary }]}>
              {t('Get the Android app')}
            </ThemedText>
          </HoverPressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.downloadNote}>
            {t('Android · v{version} · free', { version: ANDROID_APP_VERSION })}
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

function SidebarItem({ isFocused, icon, label, ref: _ref, children: _children, ...props }: ButtonProps) {
  const theme = useTheme();
  return (
    <HoverPressable
      {...props}
      accessibilityLabel={label}
      style={(hovered, pressed) => [
        styles.sidebarItem,
        isFocused ? { backgroundColor: theme.primarySoft } : hovered ? { backgroundColor: theme.backgroundSelected } : null,
        pressed && styles.pressed,
      ]}>
      {icon && <Image source={icon} style={[styles.sidebarIcon, { tintColor: isFocused ? theme.primary : theme.textSecondary }]} />}
      <ThemedText style={[isFocused && styles.bold, { color: isFocused ? theme.primary : theme.text }]}>{label}</ThemedText>
      {isFocused && <View style={[styles.activeDot, { backgroundColor: theme.gold }]} />}
    </HoverPressable>
  );
}

/** A Pressable that also knows when the mouse is over it, for a cheap hover feel on desktop. */
function HoverPressable({
  style,
  ...props
}: Omit<ComponentProps<typeof Pressable>, 'style'> & { style: (hovered: boolean, pressed: boolean) => StyleProp<ViewStyle> }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      {...props}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => style(hovered, pressed)}
    />
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
  // Desktop sidebar
  wideRoot: { flex: 1, flexDirection: 'row' },
  wideSlot: { flex: 1, height: '100%' },
  sidebar: {
    width: SidebarWidth,
    height: '100%',
    borderRightWidth: 1,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, paddingHorizontal: Spacing.two },
  brandFlower: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, fontWeight: 700 },
  nav: { gap: Spacing.one, flex: 1 },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    cursor: 'pointer',
  },
  sidebarIcon: { width: 20, height: 20 },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 'auto' },
  bold: { fontWeight: 700 },
  download: { borderRadius: 18, padding: Spacing.three, gap: Spacing.two },
  downloadBtn: { borderRadius: 999, paddingVertical: Spacing.two + 2, alignItems: 'center', cursor: 'pointer' },
  downloadNote: { textAlign: 'center' },
});
