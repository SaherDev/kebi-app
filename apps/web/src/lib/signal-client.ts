import { Capacitor } from '@capacitor/core';
import type { ChipItem } from '@kebi-app/shared';
import { FetchClient } from '../api/transports/fetch.transport';

export interface SignalClient {
  acceptRecommendation(recommendationId: string, placeId: string): Promise<void>;
  rejectRecommendation(recommendationId: string, placeId: string): Promise<void>;
  confirmChips(chips: ChipItem[]): Promise<void>;
}

function makeRealSignalClient(getToken: () => Promise<string>): SignalClient {
  const apiBase = Capacitor.isNativePlatform()
    ? (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '')
    : '';
  const http = new FetchClient(apiBase, getToken);

  async function post(body: Record<string, unknown>): Promise<void> {
    try {
      await http.post('/api/v1/signal', body);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        console.warn('[signal-client] 404 — recommendation not found', body);
        return;
      }
      throw err;
    }
  }

  return {
    acceptRecommendation: (recommendationId, placeId) =>
      post({ signal_type: 'recommendation_accepted', recommendation_id: recommendationId, place_id: placeId }),
    rejectRecommendation: (recommendationId, placeId) =>
      post({ signal_type: 'recommendation_rejected', recommendation_id: recommendationId, place_id: placeId }),
    confirmChips: (chips) =>
      post({ signal_type: 'chip_confirm', metadata: { chips } }),
  };
}

const fixtureSignalClient: SignalClient = {
  acceptRecommendation: () => Promise.resolve(),
  rejectRecommendation: () => Promise.resolve(),
  confirmChips: () => Promise.resolve(),
};

export function getSignalClient(getToken: () => Promise<string>): SignalClient {
  if (process.env.NEXT_PUBLIC_CHAT_FIXTURES === 'true') return fixtureSignalClient;
  return makeRealSignalClient(getToken);
}
