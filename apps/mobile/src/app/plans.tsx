import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { ScreenTitle } from '../components/screen-title';
import { useTranslation } from '../i18n/context';

export default function PlansScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
          right={
            <TopPill>
              <IconButton icon="ellipsis" label={t('common.more')} />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title={t('titles.plans')} />
    </ScreenScaffold>
  );
}
