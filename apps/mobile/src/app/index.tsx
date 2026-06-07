import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { Icon } from '../components/icon';
import { ScreenTitle } from '../components/screen-title';
import { useSaveSheet } from '../components/save-sheet-context';
import { useTranslation } from '../i18n/context';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const saveSheet = useSaveSheet();
  return (
    <ScreenScaffold
      topBar={
        <TopBar
          // Location-row chrome only — the locality/weather text arrives with
          // the location feature (no fabricated data, ADR-041).
          left={<Icon name="pin" size={13} className="text-text-muted" />}
          right={
            <TopPill>
              <IconButton icon="share-in" label={t('nav.savePlace')} onPress={saveSheet.open} />
              <IconButton icon="book" label={t('nav.library')} onPress={() => router.push('/library')} />
              <IconButton icon="gear" label={t('nav.settings')} onPress={() => router.push('/settings')} />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title={t('titles.home')} />
    </ScreenScaffold>
  );
}
