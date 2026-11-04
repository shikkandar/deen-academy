import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { useAppLanguage } from '@/lib/app-state';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const t = useT();
  const lang = useAppLanguage();
  // Five Tamil labels (அமைப்புகள், தொழுகை…) are wider than the English ones; a size smaller keeps them from being cut.
  const fontSize = lang === 'ta' ? 10 : 12;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.primarySoft}
      labelStyle={{ default: { fontSize }, selected: { fontSize, color: colors.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('Prayers')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Five tabs on Android: the Namaz Assistant has one; the Quran is on the Library shelf. */}
      <NativeTabs.Trigger name="namaz">
        <NativeTabs.Trigger.Label>{t('Namaz')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/namaz.png')}
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

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('Settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/settings.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
