import { getShareExtensionKey } from 'expo-share-intent';

/**
 * expo-router intercept for the iOS "Save to Kebi" share extension. The extension
 * opens the app at `mobile://dataUrl=<shareKey>`, which is not a real route — left
 * alone, expo-router renders its "Unmatched Route" screen. Redirect that one URL to
 * home, where the globally-mounted ShareIntentReceiver (in _layout) reads the shared
 * link from the native module and raises the pre-filled save sheet. Every other path
 * passes through untouched.
 */
export function redirectSystemPath({ path }: { path: string; initial: string }): string {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
