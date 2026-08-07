import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { ChatEntity } from '@kebi-app/shared';

/**
 * Opens the place screen behind a chat entity — the tap handler for both the
 * inline `kebi://` links and the {@link ChatEntityRail} chips.
 *
 * A chat entity carries only `{ kind, key, name, icon }`, and `key` is the
 * place's `places.id` (ADR-136). Since ADR-151 that id is all the place screen
 * needs: `GET /v1/places/{id}` opens **any** place kebi has surfaced, saved or
 * not, so a venue kebi discovered this turn opens the same screen a library row
 * does — the tap just navigates and the screen does the fetch.
 *
 * (This replaced a sweep of the caller's library pages looking for a matching
 * `place.id`, which was the only lookup available before place-by-id existed
 * and which missed every discovered place — the ones kebi is for.)
 *
 * `closeChat` is required, not optional: chat is an **overlay above the route
 * stack**, not a screen in it, so pushing `/place` under an open chat lands the
 * screen behind it and the tap looks like it did nothing. Closing first is the
 * same order the `?` help button uses.
 */

/**
 * `/place?from=…` marker meaning "chat opened this". The place screen reads it
 * to decide whether popping should raise the chat again; it lives here, next to
 * the only code that sets it, so the two never drift.
 */
export const PLACE_ORIGIN_CHAT = 'chat';

export function useOpenChatVenue(closeChat: () => void): (entity: ChatEntity) => void {
  const router = useRouter();

  return useCallback(
    (entity: ChatEntity) => {
      if (entity.kind !== 'venue') return;
      closeChat();
      // `from` tells the place screen to raise the chat again when it pops —
      // chat is an overlay, so a plain back lands on home and the conversation
      // the user was reading is gone from view.
      router.push({
        pathname: '/place',
        params: { id: entity.key, from: PLACE_ORIGIN_CHAT },
      });
    },
    [closeChat, router],
  );
}
