import { useState } from 'react';
import { ScrollView, View, Text, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { FeedbackCategory, FeedbackRequest } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Icon } from '../components/icon';
import { Group } from '../components/group';
import { SettingsRow } from '../components/settings-row';
import { FeedbackFormSheet } from '../components/feedback-form-sheet';
import { ReportSaveSheet } from '../components/report-save-sheet';
import { ReportWrongAnswerSheet } from '../components/report-wrong-answer-sheet';
import { useChatTranscript } from '../components/chat-transcript-context';
import { useToast } from '../components/toast-context';
import { useApiClient } from '../api/hooks';
import { sendFeedback } from '../api/feedback';
import { latestExchange, toFeedbackTranscript } from '../lib/feedback-transcript';
import { recentSaveAttempts } from '../lib/save-history';
import { useTranslation } from '../i18n/context';

/**
 * Help — "what's up?" (kebi-help-mockup.html). Reached from the chat top bar's
 * ? button and the settings help row. Three rows in two groups open the
 * feedback form sheets; no FAQ in v1 (reports will tell us what a FAQ should
 * say). Footer is the app version only.
 */
/** App + device context stamped onto every report (bug triage asked for it). */
function deviceMeta(): Pick<FeedbackRequest, 'app_version' | 'platform' | 'os_version' | 'device'> {
  return {
    app_version: Constants.expoConfig?.version ?? undefined,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    os_version: Device.osVersion ?? undefined,
    device: Device.modelName ?? undefined,
  };
}

export default function HelpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const client = useApiClient();
  const { turns } = useChatTranscript();

  const [wrongOpen, setWrongOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const anySheetOpen = wrongOpen || saveOpen || bugOpen || messageOpen;

  const version = Constants.expoConfig?.version ?? '';
  const chevron = <Icon name="chevron-right" size={14} className="text-text-soft" />;
  const exchange = latestExchange(turns);
  const saveAttempts = recentSaveAttempts();

  // Resolving closes the sheet + toasts; throwing keeps it open (draft intact)
  // behind the error toast, so a network blip isn't a dead end.
  const submit = async (body: FeedbackRequest, close: () => void) => {
    try {
      await sendFeedback(client, body);
    } catch (error) {
      toast.show({ tone: 'danger', icon: 'alert', text: t('help.toastError') });
      throw error;
    }
    close();
    toast.show({ tone: 'success', icon: 'check', text: t('help.toastSent') });
  };

  const submitWrongAnswer = (payload: { category?: FeedbackCategory; text?: string }) =>
    submit(
      {
        kind: 'wrong_answer',
        ...payload,
        exchange,
        transcript: toFeedbackTranscript(turns),
        ...deviceMeta(),
      },
      () => setWrongOpen(false),
    );

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
            emoji="🔖"
            label={t('help.rowSave')}
            sublabel={t('help.rowSaveSub')}
            onPress={() => setSaveOpen(true)}
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

      <ReportWrongAnswerSheet
        open={wrongOpen}
        onClose={() => setWrongOpen(false)}
        onSubmit={submitWrongAnswer}
        exchange={exchange}
      />
      <ReportSaveSheet
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSubmit={(payload) =>
          submit(
            {
              kind: 'extraction',
              ...payload,
              save_attempts: saveAttempts.length ? saveAttempts : undefined,
              ...deviceMeta(),
            },
            () => setSaveOpen(false),
          )
        }
        latest={saveAttempts[saveAttempts.length - 1]}
      />
      <FeedbackFormSheet
        open={bugOpen}
        onClose={() => setBugOpen(false)}
        onSubmit={(text) => submit({ kind: 'bug', text, ...deviceMeta() }, () => setBugOpen(false))}
        eyebrow={t('help.sheetBugEyebrow')}
        title={t('help.sheetBugTitle')}
        placeholder={t('help.sheetBugPlaceholder')}
        note={t('help.sheetBugNote')}
      />
      <FeedbackFormSheet
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        onSubmit={(text) =>
          submit({ kind: 'message', text, ...deviceMeta() }, () => setMessageOpen(false))
        }
        eyebrow={t('help.sheetMessageEyebrow')}
        title={t('help.sheetMessageTitle')}
        placeholder={t('help.sheetMessagePlaceholder')}
        note={t('help.sheetMessageNote')}
      />
    </ScreenScaffold>
  );
}
