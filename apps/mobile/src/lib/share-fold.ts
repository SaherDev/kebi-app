import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the user has folded the "while you were away" card away.
 *
 * Persisted rather than held in component state: home unmounts every time the
 * user opens a place, and a fold that springs back open on return is not a fold.
 * Folding is per-user-intent, not per-share — a new share does not unfold it,
 * because the folded row says how many are waiting.
 */
const FOLD_KEY = 'kebi.share.folded';

/** The stored preference; false when never set. */
export async function getShareFolded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FOLD_KEY)) === 'true';
  } catch {
    return false;
  }
}

/**
 * Forget the fold, on sign-out. Small, but it is still one person's choice
 * about their own card — the next account starts with the card open.
 */
export async function clearShareFolded(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FOLD_KEY);
  } catch {
    // Non-fatal.
  }
}

/** Persist the choice. Best-effort — a storage failure only costs this session. */
export async function setShareFolded(folded: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(FOLD_KEY, folded ? 'true' : 'false');
  } catch {
    // Non-fatal: the in-memory state still applies until the app restarts.
  }
}
