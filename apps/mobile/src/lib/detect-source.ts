import type { PlaceSource } from '@kebi-app/shared';

/**
 * Save-sheet source detection. The user pastes a link or types a place name; we
 * read what they typed to drive the meta hint ("looks like a tiktok link") and,
 * in the wiring pass, the `source` sent to the gateway. Pure and client-only —
 * mirrors the login `detectChannel`. Returns the canonical `PlaceSource`.
 *
 * Only the link sources are detectable from text. A plain place name (or empty
 * input, or an unrecognised URL) reads as `manual` — added by the user. `kebi`
 * is never returned here: it's AI-found provenance, not user input.
 */

/** Host substrings that map a pasted URL to a known link source. */
const SOURCE_HOSTS: ReadonlyArray<{ source: PlaceSource; hosts: readonly string[] }> = [
  { source: 'tiktok', hosts: ['tiktok.com'] },
  { source: 'instagram', hosts: ['instagram.com'] },
  { source: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { source: 'google_maps_list', hosts: ['maps.app.goo.gl', 'google.com/maps', 'maps.google.com'] },
];

/** Link sources surface a meta hint in the sheet; `manual` shows none. */
export const LINK_SOURCES: readonly PlaceSource[] = SOURCE_HOSTS.map((entry) => entry.source);

export function detectSource(value: string): PlaceSource {
  const text = value.trim().toLowerCase();
  if (text === '') return 'manual';
  for (const { source, hosts } of SOURCE_HOSTS) {
    if (hosts.some((host) => text.includes(host))) return source;
  }
  return 'manual';
}

/** Whether the detected source warrants showing the meta hint row. */
export function isLinkSource(source: PlaceSource): boolean {
  return LINK_SOURCES.includes(source);
}
