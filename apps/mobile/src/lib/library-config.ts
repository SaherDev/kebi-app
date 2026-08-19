/**
 * Library tunables. Kept here (not inline) so paging size is one named value.
 */

/** Places fetched per page (api-contract.md allows 1–100, default 50). */
export const LIBRARY_PAGE_LIMIT = 50;

/**
 * How long typing settles before a search request goes out. `q` is a server
 * param now (ADR-164), so a word should cost one request, not one per letter.
 */
export const LIBRARY_SEARCH_DEBOUNCE_MS = 250;

/**
 * Rows to have in hand before the Library stops loading sections up front.
 *
 * Sections load on demand, but a screen opening on a stack of headings with
 * nothing under them reads as broken — and with too little content to scroll,
 * `onEndReached` never fires to fix itself. So the first load keeps pulling
 * sections until it has roughly a screenful.
 */
export const LIBRARY_MIN_INITIAL_ROWS = 12;

/**
 * Saves a neighbourhood needs before it gets a heading of its own.
 *
 * kebi keys saves as deep as it can, which scatters a city into one-save
 * districts — a library of 37 places became fifteen headings, most of them
 * `1`. Below this, a neighbourhood folds into its city instead, so Bangkok is
 * one group rather than five, while Canggu and Uluwatu keep the names people
 * actually use for them.
 */
export const LIBRARY_MIN_GROUP_SIZE = 3;
