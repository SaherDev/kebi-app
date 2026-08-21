import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * Any URL that doesn't match a route (ADR-056). Without this file expo-router
 * renders its own "Unmatched Route" screen — developer copy, a raw URL and a
 * system font, the one place the app would show framework chrome.
 *
 * An old deep link, a share-extension URL whose shape changed, a back-stack
 * entry that outlived an update. Same treatment as the other two dead ends (a
 * gone place, a gone area): one sentence naming the likely cause, one way out,
 * and **no retry** — a route that doesn't exist never will.
 *
 * `take me home` rather than "go back", because the back stack may be the thing
 * that's broken. Note `+native-intent.ts` still redirects the share-extension
 * URL specifically: swallowing *every* unmatched path there would hide a broken
 * link shape behind a home screen instead of surfacing it here.
 */
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
        />
      }
    >
      <View className="flex-1 items-center justify-center gap-3 px-8 pb-24">
        <Text className="text-[28px]">🧭</Text>
        <Text className="text-center text-body font-semibold text-text">{t('notFound.title')}</Text>
        <Text className="text-center text-small leading-5 text-text-muted">
          {t('notFound.hint')}
        </Text>
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          accessibilityLabel={t('notFound.home')}
          className={`mt-1 rounded-card border border-surface-2 px-4 py-2.5 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{t('notFound.home')}</Text>
        </Pressable>
      </View>
    </ScreenScaffold>
  );
}
