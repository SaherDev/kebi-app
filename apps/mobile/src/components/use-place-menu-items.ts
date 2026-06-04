import { useMemo } from 'react';
import type { PlaceCore } from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import { useToast } from './toast-context';
import { triggerHaptic } from '../lib/haptics';
import type { ContextMenuItem } from './context-menu/context-menu-types';

/**
 * The place action set shared by the library long-press menu and the place-page
 * ••• overflow menu (kebi-tokens-mockup.html §13/§14): looks right · i like this
 * one · been there · (divider) · forget this place.
 *
 * "forget this place" fires the `forget-place` warning haptic and an undo toast;
 * the accept/like/visited signals and the actual removal are the gateway's job
 * (TODO) — this wires the UX path only.
 */

// Positive signals are not wired to the gateway yet (TODO below).
const pendingSignal = () => undefined;

export function usePlaceMenuItems(place: PlaceCore): ContextMenuItem[] {
  const { t } = useTranslation();
  const toast = useToast();

  return useMemo<ContextMenuItem[]>(
    () => [
      // TODO(gateway): POST the accept / like / visited signals for this place.
      { emoji: '👍', label: t('placeMenu.looksRight'), onPress: pendingSignal },
      { emoji: '❤️', label: t('placeMenu.like'), onPress: pendingSignal },
      { emoji: '✅', label: t('placeMenu.beenThere'), onPress: pendingSignal },
      {
        emoji: '🗑️',
        label: t('placeMenu.forget'),
        destructive: true,
        onPress: () => {
          triggerHaptic('forget-place');
          // TODO(gateway): optimistic remove + POST the forget signal; on failure
          // restore the row and show the "couldn't remove that one" error toast.
          toast.show({
            tone: 'danger',
            icon: 'trash',
            text: t('toast.removed', { name: place.place_name }),
            action: { label: t('toast.undo'), onPress: () => triggerHaptic('toast-undo') },
          });
        },
      },
    ],
    [t, toast, place.place_name],
  );
}
