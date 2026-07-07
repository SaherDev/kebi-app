import { FetchClient } from './transports/fetch.transport';

/**
 * Creates an authenticated API client pointed at the gateway.
 * Base URL comes from EXPO_PUBLIC_API_URL (inlined by Expo at bundle time).
 * Pass a token getter that resolves the current Bearer token.
 */
export function createApiClient(getToken: () => Promise<string>) {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not set');
  }
  return new FetchClient(baseUrl, getToken);
}
