/**
 * Library filter-sheet status buckets → `GET /v1/user/library` query params.
 * The sheet offers a single-select status; each bucket maps to the server-side
 * flag(s) the gateway forwards. `all` clears the status constraint.
 */

export type LibraryStatusFilter =
  | "all"
  | "beenSaved"
  | "new"
  | "approved"
  | "approve";

/** The subset of library query params a status bucket sets. */
export interface LibraryStatusParams {
  visited?: boolean;
  approved?: boolean;
}

export const STATUS_FILTERS: Record<LibraryStatusFilter, LibraryStatusParams> = {
  all: {},
  beenSaved: { visited: true },
  new: { visited: false },
  approved: { approved: true },
  approve: { approved: false },
};
