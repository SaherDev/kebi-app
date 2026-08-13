import type { SaveUserPlaceRequest, UpdateUserPlaceRequest } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import {
  LibraryResponse,
  LibraryResponseSchema,
  PlaceView,
  PlaceViewSchema,
  UserPlace,
  UserPlaceSchema,
} from './models/library';

/**
 * The place reads and writes (api-contract.md §GET /v1/user/library,
 * §GET /v1/places/{id}, §POST /v1/user/places, §PATCH/DELETE
 * /v1/user/places/{id}). Thin functions over the injected {@link HttpClient};
 * responses are validated at this boundary (ADR-046) into class instances.
 * Identity is the gateway's verified header — never a body/query field.
 */

/** Query params for a Library page. Server-side sort + status filter; keyset cursor. */
export interface LibraryQuery {
  sort?: 'recent' | 'name';
  visited?: boolean;
  approved?: boolean;
  limit?: number;
  cursor?: string;
}

/** Build the `?…` query string, omitting unset params. */
export function libraryQueryString(query: LibraryQuery): string {
  const params = new URLSearchParams();
  if (query.sort) params.set('sort', query.sort);
  if (query.visited !== undefined) params.set('visited', String(query.visited));
  if (query.approved !== undefined) params.set('approved', String(query.approved));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** GET a page of the caller's saved places. */
export async function getLibrary(
  client: HttpClient,
  query: LibraryQuery = {},
): Promise<LibraryResponse> {
  const raw = await client.get(`${API_ROUTES.library}${libraryQueryString(query)}`);
  return validate(LibraryResponseSchema, raw, 'LibraryResponse');
}

/**
 * GET one place, saved by the caller or not (api-contract.md
 * §GET /v1/places/{id}, ADR-151) — the place screen behind every venue link.
 * `user_data` comes back `null` when the caller never saved it, which is the
 * screen's cue to offer {@link saveUserPlace} instead of the user-state layer.
 */
export async function getPlace(client: HttpClient, placeId: string): Promise<PlaceView> {
  const raw = await client.get(API_ROUTES.place(placeId));
  return validate(PlaceViewSchema, raw, 'PlaceView');
}

/**
 * POST a save for a place kebi surfaced — the place screen's "save"
 * (api-contract.md §POST /v1/user/places). Returns the created user-state
 * (`201`), validated into a `UserPlace` so the screen gets `user_place_id` and
 * can flip to the saved state without refetching. The server stamps
 * `source: kebi` and emits the strong taste signal; re-saving is idempotent.
 */
export async function saveUserPlace(
  client: HttpClient,
  body: SaveUserPlaceRequest,
): Promise<UserPlace> {
  const raw = await client.post(API_ROUTES.userPlaces, body);
  return validate(UserPlaceSchema, raw, 'LibraryUserData');
}

/** PATCH one save's user-state (pills / menu actions); returns the full new state. */
export async function updateUserPlace(
  client: HttpClient,
  userPlaceId: string,
  patch: UpdateUserPlaceRequest,
): Promise<UserPlace> {
  const raw = await client.patch(API_ROUTES.userPlace(userPlaceId), patch);
  return validate(UserPlaceSchema, raw, 'LibraryUserData');
}

/** DELETE one saved place from the caller's library (204, idempotent). */
export async function deleteUserPlace(client: HttpClient, userPlaceId: string): Promise<void> {
  await client.delete(API_ROUTES.userPlace(userPlaceId));
}
