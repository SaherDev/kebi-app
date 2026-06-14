import type { SseEvent } from '@kebi-app/shared';
import { streamChat } from './chat';
import { API_ROUTES } from './routes';
import { makeFakeClient } from '../test-utils/fake-http-client';

async function collect(it: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const out: SseEvent[] = [];
  for await (const ev of it) out.push(ev);
  return out;
}

describe('streamChat', () => {
  it('POST-streams the chat route with { message, location } only', async () => {
    const client = makeFakeClient();
    await collect(streamChat(client, 'drinks tonight', { lat: 1, lng: 2 }));

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].method).toBe('POST_STREAM');
    expect(client.calls[0].path).toBe(API_ROUTES.chat);
    expect(client.calls[0].body).toEqual({
      message: 'drinks tonight',
      location: { lat: 1, lng: 2 },
    });
    // movement_profile is server-injected (ADR-037) — never sent by the client.
    expect(client.calls[0].body).not.toHaveProperty('movement_profile');
  });

  it('passes a null location through unchanged', async () => {
    const client = makeFakeClient();
    await collect(streamChat(client, 'hi', null));
    expect(client.calls[0].body).toEqual({ message: 'hi', location: null });
  });

  it('yields the transport frames unchanged', async () => {
    const frames: SseEvent[] = [
      { type: 'message', data: { content: 'hey' } } as SseEvent,
      { type: 'done', data: { tool_calls_used: 0 } } as SseEvent,
    ];
    const out = await collect(streamChat(makeFakeClient({ stream: frames }), 'hi', null));
    expect(out.map((e) => e.type)).toEqual(['message', 'done']);
  });
});
