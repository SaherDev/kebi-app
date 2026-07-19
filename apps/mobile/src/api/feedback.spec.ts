import { sendFeedback } from './feedback';
import { API_ROUTES } from './routes';
import { makeFakeClient } from '../test-utils/fake-http-client';

describe('sendFeedback', () => {
  it('POSTs the report body to the feedback route', async () => {
    const client = makeFakeClient({ payload: { status: 'received' } });

    await sendFeedback(client, {
      kind: 'wrong_answer',
      category: 'wrong_place',
      text: 'somewhere actually quiet',
      exchange: { you: 'quiet cafe', kebi: 'Streamer Coffee' },
      transcript: [{ role: 'you', text: 'quiet cafe', at: '2026-07-19T12:00:00Z' }],
      app_version: '1.0.0',
      platform: 'ios',
    });

    expect(client.calls).toEqual([
      {
        method: 'POST',
        path: API_ROUTES.feedback,
        body: expect.objectContaining({
          kind: 'wrong_answer',
          category: 'wrong_place',
          transcript: [{ role: 'you', text: 'quiet cafe', at: '2026-07-19T12:00:00Z' }],
        }),
      },
    ]);
  });

  it('sends a bug report without transcript machinery', async () => {
    const client = makeFakeClient({ payload: { status: 'received' } });

    await sendFeedback(client, { kind: 'bug', text: 'it crashed', app_version: '1.0.0' });

    expect(client.calls[0].body).toEqual({
      kind: 'bug',
      text: 'it crashed',
      app_version: '1.0.0',
    });
  });

  it('propagates a transport error (e.g. the 429 cap) to the caller', async () => {
    const client = makeFakeClient();
    client.post = async () => {
      throw new Error('429 rate limited');
    };

    await expect(sendFeedback(client, { kind: 'message', text: 'hi' })).rejects.toThrow(
      '429 rate limited',
    );
  });
});
