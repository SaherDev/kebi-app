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

