import type { SaveUserPlaceRequest, UpdateUserPlaceRequest } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import {
  LibraryAreasResponse,
  LibraryAreasResponseSchema,
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

/**
 * Query params for a Library page. `q` searches the whole library server-side
 * (ADR-164) and `area` narrows to one geo key by prefix (ADR-165); paging is
 * keyset via `cursor`.
 */
export interface LibraryQuery {
  q?: string;
  area?: string;
  limit?: number;
  cursor?: string;
}

/** Build the `?…` query string, omitting unset params. */
export function libraryQueryString(query: LibraryQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.area) params.set('area', query.area);
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
 * GET which areas the caller's saves fall into, with exact whole-library counts
 * (api-contract.md §GET /v1/user/library/areas, ADR-165) — the Library's
 * grouping index. Complete, unpaged, and always unfiltered, so it is fetched
 * once per screen visit rather than per query.
 */
export async function getLibraryAreas(client: HttpClient): Promise<LibraryAreasResponse> {
  const raw = await client.get(API_ROUTES.libraryAreas);
  return validate(LibraryAreasResponseSchema, raw, 'LibraryAreasResponse');
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
