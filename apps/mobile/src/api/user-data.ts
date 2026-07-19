import type { DataScope } from '@kebi-app/shared';
import type { HttpClient } from './types';
import { API_ROUTES } from './routes';

/**
 * Wipe the caller's AI-owned data (api-contract.md §DELETE /v1/user/data).
 * No scope → full "nuke my data" (places, taste model, history) — the settings
 * flow. `['chat_history']` → conversation memory only (the LangGraph checkpoint
 * thread + recalled intents), leaving saves/taste untouched — the chat clear.
 * The account itself stays either way.
 */
export async function deleteUserData(client: HttpClient, scopes?: DataScope[]): Promise<void> {
  const query = scopes?.length
    ? `?${scopes.map((s) => `scope=${encodeURIComponent(s)}`).join('&')}`
    : '';
  await client.delete(`${API_ROUTES.userData}${query}`);
}
