import { useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import type { ChatEntity, SavedPlaceView } from '@kebi-app/shared';
import { useApiClient } from '../api/hooks';
import { getLibrary } from '../api/library';
import { LIBRARY_LOOKUP_MAX_PAGES, LIBRARY_PAGE_LIMIT } from '../lib/library-config';
import { usePlaceDetail } from './place-detail-context';
import { useToast } from './toast-context';
import { useTranslation } from '../i18n/context';

/**
 * Opens the venue card behind a chat entity — the tap handler for both the
 * inline `kebi://` links and the {@link ChatEntityRail} chips.
 *
 * The place screen renders a `SavedPlaceView` handed to it in memory
 * (place-detail-context, "data path A"), and a chat entity carries only
 * `{ kind, key, name, icon }` — so the view has to be resolved from somewhere.
 * The only endpoint that returns one is `GET /v1/user/library`, so a tap
 * resolves against **the caller's saves**, matching `place.id` to the entity's
 * `key` (both are `places.id`).
 *
 * That means a venue the user has saved opens its real card, and a venue kebi
 * discovered this turn cannot — there is no `GET /v1/places/{id}` in the
 * contract (api-contract.md lists every route; none returns a place by id).
 * Rather than open a half-empty card off the entity's name, the unresolved case
 * says so in a toast. When kebi ships place-by-id, only the lookup below
 * changes — the rail, the links, and the navigation stay as they are.
 *
 * `closeChat` is required, not optional: chat is an **overlay above the route
 * stack**, not a screen in it, so pushing `/place` under an open chat lands the
 * card behind it and the tap looks like it did nothing. Closing first is the
 * same order the `?` help button uses.
 */
export function useOpenChatVenue(closeChat: () => void): (entity: ChatEntity) => void {
  const router = useRouter();
  const client = useApiClient();
  const placeDetail = usePlaceDetail();
  const { show } = useToast();
  const { t } = useTranslation();
  // One lookup at a time — a double-tap shouldn't fire two library sweeps.
  const busyRef = useRef(false);

  return useCallback(
    (entity: ChatEntity) => {
      if (entity.kind !== 'venue' || busyRef.current) return;
      busyRef.current = true;

      void (async () => {
        try {
          const view = await findSavedPlace(
            (cursor) => getLibrary(client, { limit: LIBRARY_PAGE_LIMIT, cursor }),
            entity.key,
          );
          if (view) {
            placeDetail.set(view);
            closeChat();
            router.push('/place');
          } else {
            show({ text: t('chat.venueUnavailable'), icon: 'alert' });
          }
        } catch {
          // A failed lookup is not the user's problem to debug — same line as
          // the not-found case; the stream's own errors surface in-turn.
          show({ text: t('chat.venueUnavailable'), icon: 'alert' });
        } finally {
          busyRef.current = false;
        }
      })();
    },
    [client, closeChat, placeDetail, router, show, t],
  );
}

/**
 * Walk the caller's library pages for the place with this id. Bounded by
 * {@link LIBRARY_LOOKUP_MAX_PAGES} so a large stash can't turn one tap into an
 * unbounded sweep; past that the place reads as unavailable.
 */
export async function findSavedPlace(
  fetchPage: (cursor?: string) => Promise<{
    places: SavedPlaceView[];
    next_cursor: string | null;
  }>,
  placeId: string,
): Promise<SavedPlaceView | null> {
  let cursor: string | undefined;

  for (let page = 0; page < LIBRARY_LOOKUP_MAX_PAGES; page++) {
    const { places, next_cursor } = await fetchPage(cursor);
    const hit = places.find((view) => view.place.id === placeId);
    if (hit) return hit;
    if (!next_cursor) return null;
    cursor = next_cursor;
  }

  return null;
}
