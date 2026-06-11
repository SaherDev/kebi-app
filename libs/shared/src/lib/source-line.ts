import type { PlaceSource } from "./category-emoji";
import type { UserPlace } from "./types";

/**
 * The Library card's source line text — pure, so web and mobile resolve it the
 * same way. The line shows the creator's `@handle` when the origin URL carries
 * one, else a generic "saved from …" label (the icon is chosen separately from
 * `user_data.source`). `source_label` is intentionally NOT used here: it is the
 * card title (see {@link placeDisplayName}).
 */

// A handle embedded as a path segment: tiktok `/@user/…`, youtube `/@channel`.
const AT_HANDLE = /\/@([A-Za-z0-9._-]+)/;
// An instagram profile URL `instagram.com/{user}/` — but not post/reel/etc.
const IG_PROFILE = /instagram\.com\/([A-Za-z0-9._]+)\/?(?:$|\?)/i;
const IG_RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "tv", "accounts"]);

/**
 * Extract an `@handle` from a save's origin URL, or `null` when the URL carries
 * no username. Works for TikTok (`/@user/`), YouTube handles (`/@channel`), and
 * Instagram profile URLs (`/user/`); post/reel/watch URLs (no username) and
 * `null` refs return `null`.
 */
export function parseSourceHandle(sourceRef: string | null): string | null {
  if (!sourceRef) return null;
  const at = AT_HANDLE.exec(sourceRef);
  if (at) return `@${at[1]}`;
  const ig = IG_PROFILE.exec(sourceRef);
  if (ig && !IG_RESERVED.has(ig[1].toLowerCase())) return `@${ig[1]}`;
  return null;
}

/**
 * The source line's text content: a parsed `@handle` when available, else the
 * generic source label key (resolve via `SOURCE_LABEL[labelKey]` or i18n).
 */
export type SourceLineText =
  | { handle: string }
  | { labelKey: PlaceSource };

export function sourceLineText(userData: UserPlace): SourceLineText {
  const handle = parseSourceHandle(userData.source_ref);
  return handle ? { handle } : { labelKey: userData.source };
}
