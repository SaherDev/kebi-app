import type { PlaceCore, SseToolResult } from '@kebi-app/shared';
import {
  chatDetailRows,
  emptyMessage,
  flattenCandidates,
  resolveEmptyReason,
} from './chat-place-card-data';

function place(name: string, over: Partial<PlaceCore> = {}): PlaceCore {
  return {
    id: null,
    provider_id: null,
    place_name: name,
    place_name_aliases: [],
    categories: ['restaurant'],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
    ...over,
  } as PlaceCore;
}

function toolResult(candidates: unknown[], empty_reason?: string): SseToolResult {
  return {
    tool: 'discover_places',
    tool_call_id: 'c1',
    payload: { candidates, ...(empty_reason ? { empty_reason } : {}) },
  } as SseToolResult;
}

const cand = (name: string, source = 'discovered', reason: string | null = null) => ({
  place: place(name),
  source,
  reason,
});

describe('flattenCandidates', () => {
  it('concatenates validated candidates across tool results, in order', () => {
    const out = flattenCandidates([
      toolResult([cand('A'), cand('B')]),
      toolResult([cand('C')]),
    ]);
    expect(out.map((c) => c.place.place_name)).toEqual(['A', 'B', 'C']);
  });

  it('skips a tool result with a null payload', () => {
    const out = flattenCandidates([
      { tool: 'find_saved', tool_call_id: 'x', payload: null } as SseToolResult,
      toolResult([cand('A')]),
    ]);
    expect(out.map((c) => c.place.place_name)).toEqual(['A']);
  });

  it('skips a payload that fails validation (render-safe, never throws)', () => {
    const bad = { tool: 'find_saved', tool_call_id: 'x', payload: { nope: true } } as SseToolResult;
    expect(flattenCandidates([bad, toolResult([cand('A')])]).map((c) => c.place.place_name)).toEqual([
      'A',
    ]);
  });

  it('returns [] when there are no candidates', () => {
    expect(flattenCandidates([toolResult([], 'no_match')])).toEqual([]);
  });
});

describe('resolveEmptyReason', () => {
  it('returns the empty_reason from a candidate-less result', () => {
    expect(resolveEmptyReason([toolResult([], 'no_match')])).toBe('no_match');
  });

  it('prefers no_location over no_match (it is actionable)', () => {
    expect(
      resolveEmptyReason([toolResult([], 'no_match'), toolResult([], 'no_location')]),
    ).toBe('no_location');
  });

  it('returns null when no result carries an empty_reason', () => {
    expect(resolveEmptyReason([toolResult([])])).toBeNull();
  });

  it('ignores a null payload and an invalid payload (render-safe)', () => {
    const bad = { tool: 'find_saved', tool_call_id: 'x', payload: { nope: true } } as SseToolResult;
    const nullPayload = { tool: 'find_saved', tool_call_id: 'y', payload: null } as SseToolResult;
    expect(resolveEmptyReason([bad, nullPayload, toolResult([], 'no_match')])).toBe('no_match');
  });
});

describe('emptyMessage', () => {
  const t = (k: string) => k; // identity — assert the chosen key

  it('uses the location-specific line for no_location', () => {
    expect(emptyMessage('no_location', t)).toBe('chat.placeCard.noLocation');
  });

  it('falls back to the generic line for no_match, unknown, and null', () => {
    expect(emptyMessage('no_match', t)).toBe('chat.placeCard.noMatch');
    expect(emptyMessage('something_new' as never, t)).toBe('chat.placeCard.noMatch');
    expect(emptyMessage(null, t)).toBe('chat.placeCard.noMatch');
  });
});

describe('chatDetailRows', () => {
  const t = (k: string) => k.split('.').pop() as string; // library.price.moderate → "moderate"

  it('drops the category row when it is only the bare category', () => {
    const rows = chatDetailRows(
      place('Wat Pho', {
        categories: ['landmark'],
        location: { lat: null, lng: null, address: null, neighborhood: 'Phra Nakhon', city: null, country: null },
      }),
      t,
    );
    expect(rows).toEqual([{ icon: 'pin', text: 'Phra Nakhon' }]);
  });

  it('keeps the category row when a price (or facet) adds to it', () => {
    const rows = chatDetailRows(
      place('Sushi Bar', {
        categories: ['restaurant'],
        tags: [{ type: 'price', value: 'moderate', source: 'llm' }],
        location: { lat: null, lng: null, address: null, neighborhood: 'Shibuya', city: null, country: null },
      }),
      t,
    );
    expect(rows[0]).toEqual({ icon: 'pin', text: 'Shibuya' });
    expect(rows[1].icon).toBe('globe');
    expect(rows[1].text).toContain('moderate'); // price segment retained
  });
});
