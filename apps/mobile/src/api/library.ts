import type { UpdateUserPlaceRequest } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import {
  LibraryResponse,
  LibraryResponseSchema,
  UserPlace,
  UserPlaceSchema,
} from './models/library';

/**
 * The Library reads (api-contract.md §GET /v1/user/library, §PATCH/DELETE
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
