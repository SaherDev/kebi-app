/**
 * Device location — the single place that touches `expo-location`.
 *
 * The chat turn sends the user's actual coordinates so kebi can resolve a
 * working location and reverse-geocode it server-side (ADR-083); lat/lng alone
 * is enough, so there's no client-side enrichment here. Don't import
 * `expo-location` anywhere else.
 *
 * Best-effort and non-blocking: a denied permission, an unavailable provider,
 * a slow/stuck GPS, or any thrown error resolves to `null` (the contract is
 * `location | null`) — it must never delay or fail the message send.
 */
import * as Location from 'expo-location';
import type { ChatLocation } from '../api/chat';

/**
 * Hard cap on waiting for a fresh GPS fix. An iOS simulator with no custom
 * location set never resolves `getCurrentPositionAsync`, which would otherwise
 * hang the send forever — so we race it against this timeout and fall back to
 * sending without a location.
 */
const FIX_TIMEOUT_MS = 4000;

/**
 * Resolve the device's current coordinates, or `null` when permission is
 * denied/undetermined or no fix is available in time. Prefers a cached fix
 * (instant); only takes a fresh, time-boxed fix when there's no cached one.
 */
export async function getDeviceLocation(): Promise<ChatLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    // A cached fix is instant — prefer it so the message sends without waiting.
    const known = await Location.getLastKnownPositionAsync();
    if (known) return toLatLng(known);

    // Otherwise a fresh fix, capped so a slow/stuck GPS can't block the send.
    const fresh = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      FIX_TIMEOUT_MS,
    );
    return fresh ? toLatLng(fresh) : null;
  } catch {
    return null;
  }
}

function toLatLng(pos: Location.LocationObject): ChatLocation {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * Reverse-geocode coordinates to a short place label for the home header — the
 * neighbourhood/district when available, else the city. Uses the device's native
 * geocoder (no API key, no network call), so it's cheap display chrome, not an
 * AI input. Best-effort: a missing result or any error resolves to `null` (the
 * header just shows less). Assumes location permission is already granted — the
 * caller resolves coordinates via `getDeviceLocation` first, which prompts.
 */
export async function getDeviceCity(coords: ChatLocation): Promise<string | null> {
  try {
    const results = await withTimeout(
      Location.reverseGeocodeAsync({ latitude: coords.lat, longitude: coords.lng }),
      FIX_TIMEOUT_MS,
    );
    const place = results?.[0];
    if (!place) return null;
    return place.district ?? place.subregion ?? place.city ?? null;
  } catch {
    return null;
  }
}

/** Resolve `promise`, or `null` if it hasn't settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}
