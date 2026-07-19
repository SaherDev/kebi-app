import { useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Icon } from '../components/icon';
import { Group } from '../components/group';
import { SettingsRow } from '../components/settings-row';
import { useTranslation } from '../i18n/context';

/**
 * Help — "what's up?" (kebi-help-mockup.html). Reached from the chat top bar's
 * ? button and the settings help row. Three rows in two groups open the
 * feedback form sheets; no FAQ in v1 (reports will tell us what a FAQ should
 * say). Footer is the app version only.
 */
export default function HelpScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [wrongOpen, setWrongOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const anySheetOpen = wrongOpen || bugOpen || messageOpen;

  const version = Constants.expoConfig?.version ?? '';
  const chevron = <Icon name="chevron-right" size={14} className="text-text-soft" />;

  return (
    <ScreenScaffold
      showFab={!anySheetOpen}
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
        />
      }
    >
      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-28 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow + hero */}
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('help.eyebrow')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('help.hero')}</Text>
        </View>

        <Group eyebrow={t('help.groupIssues')}>
          <SettingsRow
            emoji="🤔"
            label={t('help.rowWrong')}
            sublabel={t('help.rowWrongSub')}
            onPress={() => setWrongOpen(true)}
            trailing={chevron}
          />
          <SettingsRow
            emoji="🐛"
            label={t('help.rowBug')}
            sublabel={t('help.rowBugSub')}
            onPress={() => setBugOpen(true)}
            trailing={chevron}
          />
        </Group>

        <Group eyebrow={t('help.groupTalk')}>
          <SettingsRow
            emoji="💬"
            label={t('help.rowMessage')}
            sublabel={t('help.rowMessageSub')}
            onPress={() => setMessageOpen(true)}
            trailing={chevron}
          />
        </Group>

        <Text className="py-2 text-center text-small text-text-soft">
          {t('help.footerVersion', { version })}
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}
