import { sendSignal } from './signal';
import { API_ROUTES } from './routes';
import { makeFakeClient } from '../test-utils/fake-http-client';

describe('sendSignal', () => {
  it('POSTs the signal body to the signal route', async () => {
    const client = makeFakeClient({ payload: { status: 'accepted' } });

    await sendSignal(client, {
      signal_type: 'recommendation_accepted',
      recommendation_id: 'rec_1',
      place_core_id: 'place_1',
    });

    expect(client.calls).toEqual([
      {
        method: 'POST',
        path: API_ROUTES.signal,
        body: {
          signal_type: 'recommendation_accepted',
          recommendation_id: 'rec_1',
          place_core_id: 'place_1',
        },
      },
    ]);
  });

  it('forwards a reject signal too', async () => {
    const client = makeFakeClient({ payload: { status: 'accepted' } });

    await sendSignal(client, {
      signal_type: 'recommendation_rejected',
      recommendation_id: 'rec_2',
      place_core_id: 'place_2',
    });

    expect(client.calls[0].body).toMatchObject({ signal_type: 'recommendation_rejected' });
  });

  it('propagates a transport error to the caller', async () => {
    const client = makeFakeClient();
    client.post = async () => {
      throw new Error('429 rate limited');
    };

    await expect(
      sendSignal(client, {
        signal_type: 'recommendation_accepted',
        recommendation_id: 'rec_1',
        place_core_id: 'place_1',
      }),
    ).rejects.toThrow('429 rate limited');
  });
});
