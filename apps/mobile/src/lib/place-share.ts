import { Share } from 'react-native';
import { placeDisplayName, type SavedPlaceView } from '@kebi-app/shared';
import { googlePlaceUrl } from './maps-links';

/**
 * Share a saved place via the OS share sheet. The message is the place's display
 * name plus the best link we have: a durable Google Maps place URL (via
 * `provider_id`), falling back to the original source URL, then to no link.
 * Reusable from any surface (the place page's "share" service action today).
 */
export async function sharePlace(view: SavedPlaceView): Promise<void> {
  const name = placeDisplayName(view);
  const link = googlePlaceUrl(view.place) ?? view.user_data.source_ref ?? null;
  const message = link ? `${name}\n${link}` : name;
  try {
    await Share.share({ message });
  } catch {
    // User dismissed the share sheet, or it's unavailable — nothing to do.
  }
}
