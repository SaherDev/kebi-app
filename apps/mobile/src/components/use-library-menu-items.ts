import { useMemo } from 'react';
import type { SavedPlaceView } from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import type { ContextMenuItem } from './context-menu/context-menu-types';
import type { LibraryActions } from './use-library-actions';

/**
 * The Library card's long-press menu (kebi-tokens-mockup.html §13): looks-right ·
 * i like this one · been there · forget this place. Unlike the stubbed
 * {@link usePlaceMenuItems} (place page / gallery sample data), these are wired
 * to the gateway via {@link LibraryActions} — PATCH for the signals, DELETE for
 * forget — operating on a real `SavedPlaceView` (carries `user_place_id`).
 */
export function useLibraryMenuItems(
  view: SavedPlaceView,
  actions: LibraryActions,
): ContextMenuItem[] {
  const { t } = useTranslation();
  return useMemo<ContextMenuItem[]>(
    () => [
      {
        emoji: '👍',
        label: t('placeMenu.looksRight'),
        onPress: () => void actions.update(view, { approved: true }),
      },
      {
        emoji: '❤️',
        label: t('placeMenu.like'),
        onPress: () => void actions.update(view, { liked: true }),
      },
      {
        emoji: '✅',
        label: t('placeMenu.beenThere'),
        onPress: () => void actions.update(view, { visited: true }),
      },
      {
        emoji: '🗑️',
        label: t('placeMenu.forget'),
        destructive: true,
        onPress: () => actions.forget(view),
      },
    ],
    [t, view, actions],
  );
}
