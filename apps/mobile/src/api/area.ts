import type { HttpClient } from './types';
import { API_ROUTES } from './routes';
import { validate } from './validate';
import { AreaScreenView, AreaScreenViewSchema } from './models/area';

/**
 * The area read (api-contract.md §GET /v1/areas/{id}, kebi ADR-153). Thin
 * function over the injected {@link HttpClient}; the response is validated at
 * this boundary (ADR-046) into class instances. Identity is the gateway's
 * verified header — never a body/query field, so `saved_count` and the body
 * section are always the caller's own.
 */
export async function getArea(client: HttpClient, areaId: string): Promise<AreaScreenView> {
  const raw = await client.get(API_ROUTES.area(areaId));
  return validate(AreaScreenViewSchema, raw, 'AreaScreenView');
}
