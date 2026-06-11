import type { PlaceSource } from '@kebi-app/shared';
import type { IconName } from './icon';

/**
 * Save source → source-line glyph (kebi-library-mockup.html). The social
 * sources get brand-ish marks; a maps list reuses the pin, a manual save the
 * edit pencil, and a kebi-found place the sparkle. UI-only, so it lives in
 * mobile (the `IconName` set is a mobile concept) — not in shared.
 */
export const SOURCE_ICON: Record<PlaceSource, IconName> = {
  tiktok: 'tiktok',
  instagram: 'instagram',
  youtube: 'youtube',
  google_maps_list: 'pin',
  manual: 'edit',
  kebi: 'sparkle',
};
