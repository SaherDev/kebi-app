import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Shared App Group storage — the only thing the app and the "Save to Kebi"
 * share extension can both see (they are separate processes with separate
 * sandboxes). The app writes the share token here on sign-in; the extension
 * reads it to authenticate a save while the app is not running, and writes back
 * any link it could not send for the app to drain later (share-and-forget).
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule`: the module is
 * iOS-only and absent in Jest and on Android, and a missing App Group must
 * degrade to "no shared storage" — never crash a save flow.
 *
 * The native half lives in `apps/mobile/modules/app-group/` (Swift +
 * expo-module.config.json), which is where expo autolinking looks; only this
 * TypeScript face lives under `src`.
 */
interface KebiAppGroupNative {
  getItem(suite: string, key: string): string | null;
  setItem(suite: string, key: string, value: string): boolean;
  removeItem(suite: string, key: string): boolean;
  isAvailable(suite: string): boolean;
}

const native = requireOptionalNativeModule<KebiAppGroupNative>('KebiAppGroup');

/**
 * The App Group both targets are entitled to. Must match
 * `ShareExtension.entitlements` and the `iosAppGroupIdentifier` passed to the
 * expo-share-intent plugin in app.json — the extension's own handoff already
 * uses this suite.
 */
export const APP_GROUP = 'group.app.kebi';

/** True when shared storage is usable — iOS, native module present, group entitled. */
export function isAppGroupAvailable(): boolean {
  if (Platform.OS !== 'ios' || !native) return false;
  return native.isAvailable(APP_GROUP);
}

/** Read a shared value, or null when absent or unavailable. */
export function getSharedItem(key: string): string | null {
  if (Platform.OS !== 'ios' || !native) return null;
  return native.getItem(APP_GROUP, key);
}

/** Write a shared value. Returns whether it landed — callers decide what to do. */
export function setSharedItem(key: string, value: string): boolean {
  if (Platform.OS !== 'ios' || !native) return false;
  return native.setItem(APP_GROUP, key, value);
}

/** Remove a shared value (sign-out clears the share token this way). */
export function removeSharedItem(key: string): boolean {
  if (Platform.OS !== 'ios' || !native) return false;
  return native.removeItem(APP_GROUP, key);
}
