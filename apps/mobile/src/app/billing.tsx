import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { useTranslation } from '../i18n/context';

/**
 * Billing — the app's one **unbuilt** screen (ADR-056). There is no billing
 * data yet, and it is linked from settings, so people land here.
 *
 * It says what will live here and points at the screen that does work, rather
 * than rendering a heading over an empty page: a user who came looking for a
 * receipt should leave knowing there isn't one yet, not thinking the app lost
 * their payment history. The `•••` is gone with it — a menu holding nothing is
 * worse than no menu.
 *
 * The layout is the one the built screen will use, so filling it in later is
 * replacing the muted rows with real ones.
 */
const COMING = ['receipts', 'method', 'renews'] as const;

export default function BillingScreen() {
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
      <ScrollView
        contentContainerClassName="gap-5 px-6 pb-28 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('settings.yourPlan')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('titles.billing')}</Text>
          <Text className="mt-1 text-small text-text-muted">{t('billing.emptySub')}</Text>
        </View>

        <View className="rounded-large bg-surface p-3.5">
          {COMING.map((key) => (
            <View key={key} className="flex-row items-center gap-2.5 py-1.5">
              <View className="size-1 rounded-full bg-text-soft" />
              <Text className="text-small text-text-muted">{t(`billing.coming.${key}`)}</Text>
            </View>
          ))}
        </View>

        <Text className="text-small leading-5 text-text-soft">
          {t('billing.emptyHow')}{' '}
          <Text className="font-semibold text-text">{t('plans.hero')}</Text>.
        </Text>
      </ScrollView>
    </ScreenScaffold>
  );
}
