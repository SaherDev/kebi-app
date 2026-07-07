/**
 * Home-screen tunables (zero-hardcoding — values that could change live here,
 * not inline at call sites). The fallback chips shown on a transport failure are
 * i18n strings, so they live in messages, not here.
 */

/** Saved places previewed in the home "your stash" section (the rest is in /library). */
export const HOME_STASH_LIMIT = 3;

/** Recent intents shown in the home "what you wanted" section. */
export const INTENTS_PREVIEW_LIMIT = 3;

/**
 * i18n keys for the chips shown when GET /v1/home can't be reached (offline /
 * timeout). The endpoint fails open server-side, so this is only for a transport
 * failure; the strings live in messages (en.json `home.fallbackChips.*`).
 */
export const FALLBACK_CHIP_KEYS = [
  'home.fallbackChips.nearby',
  'home.fallbackChips.dinner',
  'home.fallbackChips.surprise',
] as const;
