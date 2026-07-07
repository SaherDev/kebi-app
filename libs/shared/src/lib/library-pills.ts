import type { UserPlace } from "./types";

/**
 * Library card status pills, derived from a save's user-state. Two always-on
 * axes plus an optional like verdict, so a card shows two or three pills:
 * - visited axis:  `visited` (been) | `not visited` (warm)
 * - approved axis: `approved` (curated) | `needs review` (amber, ADR-071)
 * - liked axis (tri-state): 👍 `liked` | 👎 `disliked` | null → no pill
 *
 * The like axis renders glyph-only (a 👍/👎 in place of the colour dot) so it
 * stays compact and `liked` (warm) never reads as a second `not visited`
 * (also warm). `glyph` set means render the emoji instead of the tone dot.
 *
 * Tones map to the existing pill theme tokens (light + dark already defined):
 * `green` → `pill-green-bg`/`success`, `warm` → `pill-warm-bg`/`like`,
 * `amber` → `pill-amber-bg`/`warn`, `danger` → `pill-danger-bg`/`danger`.
 */

export type PillKind =
  | "visited"
  | "notVisited"
  | "approved"
  | "needsReview"
  | "liked"
  | "disliked";
export type PillTone = "green" | "warm" | "amber" | "danger";

export interface StatusPill {
  kind: PillKind;
  tone: PillTone;
  /** Emoji shown in place of the tone dot (the like/dislike axis). */
  glyph?: string;
}

export function derivePills(userData: UserPlace): StatusPill[] {
  const visited: StatusPill = userData.visited
    ? { kind: "visited", tone: "green" }
    : { kind: "notVisited", tone: "warm" };
  const approved: StatusPill = userData.approved
    ? { kind: "approved", tone: "green" }
    : { kind: "needsReview", tone: "amber" };

  const pills = [visited, approved];

  // Tri-state: only surface a like pill when the user has an opinion.
  if (userData.liked === true) {
    pills.push({ kind: "liked", tone: "warm", glyph: "👍" });
  } else if (userData.liked === false) {
    pills.push({ kind: "disliked", tone: "danger", glyph: "👎" });
  }

  return pills;
}
