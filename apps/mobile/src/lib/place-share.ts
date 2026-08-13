import { Share } from 'react-native';
import { placeDisplayName, type PlaceView } from '@kebi-app/shared';
import { googleMaps } from './maps-links';

/**
 * Share a place via the OS share sheet, saved or not. The message is the
 * place's display name plus the best link we have: a durable Google Maps place
 * URL (via `provider_id`), falling back to the original source URL (which only
 * a save carries), then to no link. Reusable from any surface (the place page's
 * "share" service action today).
 */
export async function sharePlace(view: PlaceView): Promise<void> {
  const name = placeDisplayName(view);
  const link = googleMaps.buildUrl(view.place) ?? view.user_data?.source_ref ?? null;
  const message = link ? `${name}\n${link}` : name;
  try {
    await Share.share({ message });
  } catch {
    // User dismissed the share sheet, or it's unavailable — nothing to do.
  }
}
