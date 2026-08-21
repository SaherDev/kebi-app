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
        // Each action names itself when it fails and offers the retry — one
        // shared "couldn't update that" covered a pill, a note and a delete
        // alike (ADR-056). The retry re-fires the same patch.
        onPress: () =>
          void update(
            view,
            { approved: true },
            { emoji: '👍', text: t('placeMenu.toast.approved') },
            { text: t('placeMenu.toast.approveFailed'), onRetry: () => void update(view, { approved: true }) },
          ),
      },
      {
        emoji: '❤️',
        label: t('placeMenu.like'),
        onPress: () =>
          void update(
            view,
            { liked: true },
            { emoji: '❤️', text: t('placeMenu.toast.liked') },
            { text: t('placeMenu.toast.likeFailed'), onRetry: () => void update(view, { liked: true }) },
          ),
      },
      {
        emoji: '✅',
        label: t('placeMenu.beenThere'),
        onPress: () =>
          void update(
            view,
            { visited: true },
            { emoji: '✅', text: t('placeMenu.toast.been') },
            { text: t('placeMenu.toast.beenFailed'), onRetry: () => void update(view, { visited: true }) },
          ),
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
