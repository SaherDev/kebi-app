import { useState } from 'react';
import { useRouter } from 'expo-router';
import { CATEGORY_EMOJI, CATEGORY_EMOJI_FALLBACK } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { ScreenTitle } from '../components/screen-title';
import { ActionSheet } from '../components/action-sheet';
import { usePlaceMenuItems } from '../components/use-place-menu-items';
import { makeSamplePlace } from '../lib/sample-place';
import { useTranslation } from '../i18n/context';

// TODO: replace with the real place loaded from the route param.
const SAMPLE_PLACE = makeSamplePlace('Nezu Shrine', ['shrine']);
const SAMPLE_EMOJI = CATEGORY_EMOJI[SAMPLE_PLACE.categories[0]] ?? CATEGORY_EMOJI_FALLBACK;

export default function PlaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
              <IconButton icon="ellipsis" label={t('common.more')} onPress={() => setMenuOpen(true)} />
            </TopPill>
          }
        />
      }
    >
      <ScreenTitle title={t('titles.place')} />
      {/* The place page has no card to long-press, so ••• opens a bottom sheet. */}
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={{ emoji: SAMPLE_EMOJI, eyebrow: t('placeMenu.thisPlace'), title: SAMPLE_PLACE.place_name }}
        items={items}
        closeLabel={t('common.close')}
      />
    </ScreenScaffold>
  );
}
