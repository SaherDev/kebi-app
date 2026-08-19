/**
 * Tunables for the "while you were away" surface (zero-hardcoding — these are
 * the numbers most likely to be argued about, so they live in one place rather
 * than inline at three call sites).
 */

/**
 * Rows the home card shows before it defers to the screen. Three: the card is a
 * notice, not a feed — every landed place is also in the stash, and everything
 * capped away is one tap behind "show all".
 */
export const SHARE_CARD_LIMIT = 3;

/**
 * How long a share stays in the history behind "show all". Dismissing the card
 * hides it from home but no longer deletes it, so something has to do the
 * forgetting; a week is long enough to answer "what did I share on the weekend"
 * and short enough that the App Group record never grows without bound.
 */
export const SHARE_HISTORY_DAYS = 7;

/** Same, in milliseconds — what the prune actually compares against. */
export const SHARE_HISTORY_MS = SHARE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
