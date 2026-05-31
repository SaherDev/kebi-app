/**
 * Theme-independent JS constants that cannot go in CSS / Tailwind:
 *   - Mascot SVG fill values (static hex, never a CSS variable).
 *   - Scrim overlay opacities.
 *   - Toast / menu shadow presets.
 *
 * Source: docs/kebi-app-design-system/kebi-tokens-mockup.html §17 (mascot)
 * and §12 / §14 (toast/overflow-menu shadows).
 *
 * These are used directly as `fill` / `stroke` props on SVG elements and as
 * `shadowColor`/`elevation` props in StyleSheet — not as Tailwind classes.
 */

/**
 * Mascot SVG palette — unchanging regardless of light/dark mode.
 * Apply via `fill` / `stroke` attributes in the mascot SVG component.
 */
export const MASCOT = {
  body:   '#D4B891',
  belly:  '#F5EBD3',
  wings:  '#A89070',
  tuft:   '#8B7355',
  beak:   '#C87A4A',
  /** cheek: use with opacity 0.6 */
  cheek:  '#E8B894',
  cheekOpacity: 0.6,
} as const;

/**
 * Scrim overlay opacity behind bottom sheets, modals.
 * Light: 0.45 · Dark: 0.55 (slightly more opaque against the near-black bg).
 * Usage: `<View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'black', opacity: SCRIM.light }}>`
 */
export const SCRIM = {
  light: 0.45,
  dark:  0.55,
} as const;

/**
 * Toast shadow (used in `shadow*` style props or `box-shadow` equivalent).
 * Source: toast-demo rule in kebi-tokens-mockup.html: `0 8px 24px rgba(0,0,0,0.18)`.
 */
export const SHADOW_TOAST = {
  shadowColor:   '#000000',
  shadowOffset:  { width: 0, height: 8 },
  shadowOpacity: 0.18,
  shadowRadius:  12, // approx blur-24 / 2
  elevation:     8,
} as const;

/**
 * Overflow-menu shadow: `0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)`.
 * RN supports a single shadow layer; use the dominant (larger) one.
 */
export const SHADOW_MENU = {
  shadowColor:   '#000000',
  shadowOffset:  { width: 0, height: 8 },
  shadowOpacity: 0.10,
  shadowRadius:  16,
  elevation:     6,
} as const;
