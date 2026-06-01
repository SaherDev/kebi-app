import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { Icon } from '../components/icon';
import { ScreenTitle } from '../components/screen-title';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <ScreenScaffold
      topBar={
        <TopBar
          // Location-row chrome only — the locality/weather text arrives with
          // the location feature (no fabricated data, ADR-041).
          left={<Icon name="pin" size={13} className="text-text-muted" />}
          right={
            <TopPill>
              <IconButton icon="share-in" label="save a place" />
              <IconButton icon="book" label="library" onPress={() => router.push('/library')} />
              <IconButton icon="gear" label="settings" onPress={() => router.push('/settings')} />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title="home" />
    </ScreenScaffold>
  );
}
