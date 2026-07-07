import type { HttpClient } from './types';
import { API_ROUTES } from './routes';

/**
 * "nuke my data" — wipes the caller's AI-owned data (places, taste model,
 * history). No scope → the gateway forwards a full delete to kebi
 * (api-contract.md §DELETE /v1/user/data). The account itself stays.
 */
export async function deleteUserData(client: HttpClient): Promise<void> {
  await client.delete(API_ROUTES.userData);
}
