import { useEffect } from 'react';
import { useShareIntentContext } from 'expo-share-intent';
import { useSaveSheet } from './save-sheet-context';

/**
 * Bridges the iOS "Save to Kebi" share extension into the in-app save flow. When
 * the app is opened from the system share sheet, the shared link (a TikTok /
 * Instagram URL) arrives here and raises the save sheet pre-filled with it — the
 * user confirms with the existing Save CTA, running the same extract → save →
 * toast path as the in-app trigger. No new API surface (ADR — share extension).
 *
 * Renders nothing. Must sit under both ShareIntentProvider (for the intent) and
 * SaveSheetProvider (for open()). AuthGate still guards auth: a share into a
 * signed-out app routes to login first, then the sheet awaits the next share.
 */
export function ShareIntentReceiver() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { open } = useSaveSheet();

  useEffect(() => {
    if (!hasShareIntent) return;
    // iOS delivers a shared link as `webUrl`; fall back to raw `text`.
    const shared = shareIntent.webUrl ?? shareIntent.text ?? '';
    if (shared.trim() !== '') open(shared);
    // Clear the intent so foreground/relaunch doesn't re-raise the sheet.
    resetShareIntent();
  }, [hasShareIntent, shareIntent, open, resetShareIntent]);

  return null;
}
