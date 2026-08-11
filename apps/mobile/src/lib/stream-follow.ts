/** Within this many px of the bottom counts as "following the stream". */
export const FOLLOW_THRESHOLD_PX = 40;

export interface FollowInput {
  /** Px of content below the viewport's bottom edge. */
  fromBottom: number;
  /** The user's finger is what is moving the list right now. */
  dragging: boolean;
  /** Whether the list was following before this scroll event. */
  following: boolean;
}

/**
 * Should the transcript keep auto-scrolling to the tail?
 *
 * Position alone cannot decide this once answers stream: the text grows a token
 * at a time, so every delta leaves the viewport momentarily short of the new
 * bottom. Read naively, that looks identical to the user having scrolled up —
 * which latches following off for the rest of the turn and types the answer out
 * of sight (the bug this exists to prevent).
 *
 * So the two transitions are asymmetric: reaching the bottom always re-arms
 * following, but only a *drag* can turn it off. Content growing under a still
 * finger changes nothing.
 */
export function shouldFollow({ fromBottom, dragging, following }: FollowInput): boolean {
  if (fromBottom <= FOLLOW_THRESHOLD_PX) return true;
  if (dragging) return false;
  return following;
}
