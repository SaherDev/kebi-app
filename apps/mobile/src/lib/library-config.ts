/**
 * Library tunables. Kept here (not inline) so paging size is one named value.
 */

/** Places fetched per page (api-contract.md allows 1–100, default 50). */
export const LIBRARY_PAGE_LIMIT = 50;

/**
 * How many library pages one place lookup may walk before giving up. Opening a
 * chat venue resolves it against the caller's saves (there is no place-by-id
 * endpoint), and a tap must not turn into an unbounded sweep of a large stash.
 */
export const LIBRARY_LOOKUP_MAX_PAGES = 4;
