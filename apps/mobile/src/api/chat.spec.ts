import type { SseEvent } from '@kebi-app/shared';
import { deviceLocalTime, streamChat } from './chat';
import { API_ROUTES } from './routes';
import { makeFakeClient } from '../test-utils/fake-http-client';

async function collect(it: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const out: SseEvent[] = [];
  for await (const ev of it) out.push(ev);
  return out;
}

describe('streamChat', () => {
  it('POST-streams the chat route with { message, location, local_time } only', async () => {
    const client = makeFakeClient();
    await collect(streamChat(client, 'drinks tonight', { lat: 1, lng: 2 }));

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].method).toBe('POST_STREAM');
    expect(client.calls[0].path).toBe(API_ROUTES.chat);
    expect(client.calls[0].body).toEqual({
      message: 'drinks tonight',
      location: { lat: 1, lng: 2 },
      local_time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
    });
    // movement_profile is server-injected (ADR-037) — never sent by the client.
    expect(client.calls[0].body).not.toHaveProperty('movement_profile');
  });

  it('passes a null location through unchanged', async () => {
    const client = makeFakeClient();
    await collect(streamChat(client, 'hi', null));
    expect(client.calls[0].body).toMatchObject({ message: 'hi', location: null });
  });

  it('stamps local_time from the device clock, with its UTC offset', () => {
    // A fixed instant + the runner's own zone: assert the shape and that the
    // wall-clock digits are the local ones, not UTC.
    const now = new Date('2026-08-10T11:30:00Z');
    const stamped = deviceLocalTime(now);

    expect(stamped).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(stamped.slice(11, 19)).toBe(
      now.toLocaleTimeString('en-GB', { hour12: false }),
    );
  });

  it('yields the transport frames unchanged', async () => {
    const frames: SseEvent[] = [
      { type: 'message', data: { content: 'hey', entities: [] } } as SseEvent,
      { type: 'done', data: { tool_calls_used: 0 } } as SseEvent,
    ];
    const out = await collect(streamChat(makeFakeClient({ stream: frames }), 'hi', null));
    expect(out.map((e) => e.type)).toEqual(['message', 'done']);
  });
});
