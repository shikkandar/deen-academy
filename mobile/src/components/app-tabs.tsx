import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useT } from '@/hooks/use-t';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const t = useT();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.primarySoft}
      labelStyle={{ selected: { color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('Prayers')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="quran">
        <NativeTabs.Trigger.Label>{t('Quran')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/quran.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="qibla">
        <NativeTabs.Trigger.Label>{t('Qibla')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/qibla.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="hadith">
        <NativeTabs.Trigger.Label>{t('Library')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/hadith.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Android allows five tabs: the Namaz Assistant has one, and Settings opens from the ⚙ on Prayers. */}
      <NativeTabs.Trigger name="namaz">
        <NativeTabs.Trigger.Label>{t('Namaz')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/namaz.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings" hidden />
    </NativeTabs>
  );
}
