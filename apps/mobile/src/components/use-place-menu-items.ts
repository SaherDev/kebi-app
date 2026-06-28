import { useMemo } from 'react';
import type { SavedPlaceView } from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import { usePlaceActions } from './place-actions-context';
import type { ContextMenuItem } from './context-menu/context-menu-types';

/**
 * The saved-place action menu (kebi-tokens-mockup.html §13/§14): looks right ·
 * i like this one · been there · (divider) · forget this place. The single menu
 * builder for every surface — the library card long-press menu and the place
 * page ••• sheet both use it. Items are wired to the global {@link usePlaceActions}
 * (PATCH for the signals, DELETE for forget), operating on a real
 * `SavedPlaceView` (carries `user_place_id`).
 */
export function usePlaceMenuItems(view: SavedPlaceView): ContextMenuItem[] {
  const { t } = useTranslation();
  const { update, forget } = usePlaceActions();

  return useMemo<ContextMenuItem[]>(
    () => [
      {
        emoji: '👍',
        label: t('placeMenu.looksRight'),
        onPress: () => void update(view, { approved: true }, { emoji: '👍', text: t('placeMenu.toast.approved') }),
      },
      {
        emoji: '❤️',
        label: t('placeMenu.like'),
        onPress: () => void update(view, { liked: true }, { emoji: '❤️', text: t('placeMenu.toast.liked') }),
      },
      {
        emoji: '✅',
        label: t('placeMenu.beenThere'),
        onPress: () => void update(view, { visited: true }, { emoji: '✅', text: t('placeMenu.toast.been') }),
      },
      {
        emoji: '🗑️',
        label: t('placeMenu.forget'),
        destructive: true,
        onPress: () => forget(view),
      },
    ],
    [t, update, forget, view],
  );
}
