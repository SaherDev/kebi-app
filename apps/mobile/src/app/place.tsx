import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { ScreenTitle } from '../components/screen-title';

export default function PlaceScreen() {
  const router = useRouter();
  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label="back" onPress={() => router.back()} />}
          right={
            <TopPill>
              <IconButton icon="edit" label="edit" />
              <IconButton icon="ellipsis" label="more" />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title="place" />
    </ScreenScaffold>
  );
}
