/**
 * Device location — the single place that touches `expo-location`.
 *
 * The chat turn sends the user's actual coordinates so kebi can resolve a
 * working location and reverse-geocode it server-side (ADR-083); lat/lng alone
 * is enough, so there's no client-side enrichment here. Don't import
 * `expo-location` anywhere else.
 *
 * Best-effort and non-blocking: a denied permission, an unavailable provider,
 * or any thrown error resolves to `null` (the contract is `location | null`),
 * never an exception in the send path.
 */
import * as Location from 'expo-location';
import type { ChatLocation } from '../api/chat';

/**
 * Resolve the device's current coordinates, or `null` when permission is
 * denied/undetermined or the fix fails. Prompts for foreground permission on
 * first call; the OS remembers the choice thereafter.
 */
export async function getDeviceLocation(): Promise<ChatLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    // No provider / simulator without a set location / transient failure —
    // fall back to no location rather than failing the message send.
    return null;
  }
}
