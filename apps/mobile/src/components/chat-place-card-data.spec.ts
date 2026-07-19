import type { PlaceCore, SseToolResult } from '@kebi-app/shared';
import {
  chatDetailRows,
  emptyMessage,
  flattenCandidates,
  hasConsultResults,
  hasPlaceCandidates,
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

function toolResult(
  candidates: unknown[],
  empty_reason?: string,
  recommendation_id = 'rec_1',
): SseToolResult {
  return {
    tool: 'discover_places',
    tool_call_id: 'c1',
    payload: { candidates, recommendation_id, ...(empty_reason ? { empty_reason } : {}) },
  } as SseToolResult;
}

const cand = (name: string, source = 'discovered', reason: string | null = null) => ({
  place: place(name),
  source,
  reason,
});

// A `research` tool result (ADR-050) — payload is a ResearchResult, not a
// ConsultResult. `payload` is overridable so tests can plant consult-shaped
// fields on it and prove discrimination is by tool name, not shape.
function researchResult(payload: Record<string, unknown> = {}): SseToolResult {
  return {
    tool: 'research',
    tool_call_id: 'r1',
    payload: {
      entity_name: 'Da Nang',
      entity_key: 'vn:da-nang',
      notes: [],
      empty_reason: null,
      clarification: null,
      ...payload,
    },
  } as SseToolResult;
}

describe('flattenCandidates', () => {
  it('concatenates validated candidates across tool results, in order', () => {
    const out = flattenCandidates([
      toolResult([cand('A'), cand('B')]),
      toolResult([cand('C')]),
    ]);
    expect(out.map((c) => c.candidate.place.place_name)).toEqual(['A', 'B', 'C']);
  });

  it('tags each candidate with its own result recommendation_id', () => {
    const out = flattenCandidates([
      toolResult([cand('A'), cand('B')], undefined, 'rec_1'),
      toolResult([cand('C')], undefined, 'rec_2'),
    ]);
    expect(out.map((c) => c.recommendationId)).toEqual(['rec_1', 'rec_1', 'rec_2']);
  });

  it('skips a tool result with a null payload', () => {
    const out = flattenCandidates([
      { tool: 'find_saved', tool_call_id: 'x', payload: null } as SseToolResult,
      toolResult([cand('A')]),
    ]);
    expect(out.map((c) => c.candidate.place.place_name)).toEqual(['A']);
  });

  it('skips a payload that fails validation (render-safe, never throws)', () => {
    const bad = { tool: 'find_saved', tool_call_id: 'x', payload: { nope: true } } as SseToolResult;
    expect(
      flattenCandidates([bad, toolResult([cand('A')])]).map((c) => c.candidate.place.place_name),
    ).toEqual(['A']);
  });

  it('returns [] when there are no candidates', () => {
    expect(flattenCandidates([toolResult([], 'no_match')])).toEqual([]);
  });

  it('skips a research result even when its payload is consult-shaped (tool-name gate, ADR-050)', () => {
    const disguised = researchResult({ candidates: [cand('X')], recommendation_id: 'rec_9' });
    expect(flattenCandidates([disguised])).toEqual([]);
    // …while a real consult result alongside it still flattens.
    expect(
      flattenCandidates([disguised, toolResult([cand('A')])]).map(
        (c) => c.candidate.place.place_name,
      ),
    ).toEqual(['A']);
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

  it("never reads a research empty_reason — the vocabularies are disjoint (ADR-050)", () => {
    // Even planted with consult-parseable fields, the tool-name gate skips it.
    const disguised = researchResult({
      candidates: [],
      recommendation_id: 'rec_9',
      empty_reason: 'no_claims',
    });
    expect(resolveEmptyReason([disguised])).toBeNull();
    // In a mixed turn, only the consult reasons count.
    expect(resolveEmptyReason([disguised, toolResult([], 'no_location')])).toBe('no_location');
  });
});

describe('hasConsultResults / hasPlaceCandidates', () => {
  it('classifies by tool name: consult tools yes; research, unknown, and null no', () => {
    expect(hasConsultResults([toolResult([])])).toBe(true);
    expect(hasConsultResults([researchResult()])).toBe(false);
    expect(
      hasConsultResults([{ tool: 'future_tool', tool_call_id: 'z', payload: {} } as SseToolResult]),
    ).toBe(false);
    expect(
      hasConsultResults([{ tool: null, tool_call_id: 'z', payload: {} } as SseToolResult]),
    ).toBe(false);
    expect(hasConsultResults([])).toBe(false);
  });

  it('gates the card surface on actual candidates, not tool presence', () => {
    expect(hasPlaceCandidates([toolResult([cand('A')])])).toBe(true);
    expect(hasPlaceCandidates([toolResult([], 'no_match')])).toBe(false);
    expect(hasPlaceCandidates([researchResult({ notes: [{ id: 'n1' }] })])).toBe(false);
    expect(hasPlaceCandidates([])).toBe(false);
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
