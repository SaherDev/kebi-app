import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { ScreenTitle } from '../components/screen-title';
import { OverflowMenu } from '../components/context-menu/overflow-menu';
import { usePlaceMenuItems } from '../components/use-place-menu-items';
import { makeSamplePlace } from '../lib/sample-place';
import { useTranslation } from '../i18n/context';

// TODO: replace with the real place loaded from the route param.
const SAMPLE_PLACE = makeSamplePlace('Nezu Shrine', ['shrine']);

export default function PlaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const moreRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const items = usePlaceMenuItems(SAMPLE_PLACE);

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
          right={
            <TopPill>
              <IconButton icon="edit" label={t('common.edit')} />
              {/* Wrapped so the overflow menu can measure and anchor under it. */}
              <View ref={moreRef} collapsable={false}>
                <IconButton
                  icon="ellipsis"
                  label={t('common.more')}
                  onPress={() => setMenuOpen(true)}
                />
              </View>
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title={t('titles.place')} />
      <OverflowMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={items}
        triggerRef={moreRef}
        closeLabel={t('common.close')}
      />
    </ScreenScaffold>
  );
}
