import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The user's theme choice. `system` follows the OS; `light`/`dark` pin it.
 * Persisted so the choice survives a cold start (NativeWind defaults to system
 * each launch otherwise). Read once at boot in the root layout.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'] as const;

const THEME_KEY = 'kebi.theme';

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** The stored choice, or null if none was ever saved (→ treat as `system`). */
export async function getStoredTheme(): Promise<ThemeChoice | null> {
  try {
    const value = await AsyncStorage.getItem(THEME_KEY);
    return isThemeChoice(value) ? value : null;
  } catch {
    return null;
  }
}

/** Persist the choice. Best-effort — a storage failure is silently ignored. */
export async function setStoredTheme(choice: ThemeChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, choice);
  } catch {
    // Non-fatal — the in-memory choice still applies for this session.
  }
}
