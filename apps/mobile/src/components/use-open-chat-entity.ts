import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import type { ChatEntity, ChatEntityKind } from '@kebi-app/shared';
import { areaIdFromUri } from '../lib/area-link';

/**
 * Opens what is behind a chat entity — the tap handler for both the inline
 * `kebi://` links and the {@link ChatEntityRail} chips.
 *
 * Every kind is a destination: a venue opens the place screen, an area opens
 * the area screen (kebi ADR-153), and a web source opens its page in the
 * browser (ADR-161 — `key` is the raw page URL, and no in-app screen exists
 * for it). Which one is a lookup in {@link OPEN_ROUTE}, not a branch, so a new
 * kind is a new entry rather than another `if` in a handler.
 *
 * The in-app kinds identify differently and that is the whole subtlety here. A
 * venue's `key` **is** `places.id`, so it can be routed straight. An area's
 * request id is the opaque token on its `uri` — its `key` is the raw geo key,
 * which no endpoint takes (ADR-153). Reading the wrong one 404s every area tap.
 *
 * `closeChat` is required, not optional: chat is an **overlay above the route
 * stack**, not a screen in it, so pushing under an open chat lands the screen
 * behind it and the tap looks like it did nothing. Closing first is the same
 * order the `?` help button uses — and it only happens when there is somewhere
 * to go, so a link this build can't resolve leaves the conversation on screen.
 * A web tap **never** closes the chat: the browser layers above the whole app,
 * so the conversation should still be there when the user comes back.
 */

/**
 * `?from=…` marker meaning "chat opened this". A detail screen reads it to
 * decide whether popping should raise the chat again; it lives here, next to
 * the only code that sets it, so the two never drift.
 *
 * It marks **one hop only**. Drilling deeper — area → area, or area → place —
 * pushes without it, so backing out of a chain lands on the previous screen
 * rather than jumping the user into chat from the middle of it.
 */
export const PLACE_ORIGIN_CHAT = 'chat';

/** Where a tapped entity goes, and what identifies it once it gets there. */
type EntityRoute =
  | {
      open: 'screen';
      pathname: string;
      /** The request id for this kind, or `null` when the entity carries none. */
      id: (entity: ChatEntity) => string | null;
    }
  | {
      open: 'browser';
      /** The page to hand the OS, or `null` when the entity carries none. */
      url: (entity: ChatEntity) => string | null;
    };

const OPEN_ROUTE: Record<ChatEntityKind, EntityRoute> = {
  // `key` is `places.id`, and GET /v1/places/{id} opens any place kebi has
  // surfaced — saved or not (ADR-151).
  venue: { open: 'screen', pathname: '/place', id: (entity) => entity.key },
  // The token off the URI, never `key`: the raw geo key is a slash path that no
  // endpoint accepts (ADR-153).
  area: { open: 'screen', pathname: '/area', id: (entity) => areaIdFromUri(entity.uri) },
  // `key` is the raw page URL (ADR-161) — no resolve endpoint exists, the
  // client hands it to the OS as-is.
  web: { open: 'browser', url: (entity) => entity.key || null },
};

export function useOpenChatEntity(closeChat: () => void): (entity: ChatEntity) => void {
  const router = useRouter();

  return useCallback(
    (entity: ChatEntity) => {
      const route = OPEN_ROUTE[entity.kind];
      if (!route) return;

      if (route.open === 'browser') {
        const url = route.url(entity);
        if (url) Linking.openURL(url);
        return;
      }

      const id = route.id(entity);
      if (!id) return;

      closeChat();
      router.push({
        pathname: route.pathname,
        params: { id, from: PLACE_ORIGIN_CHAT },
      });
    },
    [closeChat, router],
  );
}
