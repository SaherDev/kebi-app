import type { ChatTurn, KebiTurn, UserTurn } from '../components/chat-transcript-context';
import { latestExchange, toFeedbackTranscript } from './feedback-transcript';

const AT = new Date('2026-07-19T12:00:00Z').getTime();

function you(text: string, key = 'u1'): UserTurn {
  return { key, role: 'you', text, at: AT };
}

function kebi(message: string, over: Partial<KebiTurn> = {}, key = 'k1'): KebiTurn {
  return {
    key,
    role: 'kebi',
    steps: [],
    toolResults: [],
    message,
    status: 'done',
    startedAt: AT,
    collapsed: true,
    at: AT,
    ...over,
  } as KebiTurn;
}

describe('toFeedbackTranscript', () => {
  it('maps roles, texts, step titles, and tool names — never payloads', () => {
    const turns: ChatTurn[] = [
      you('quiet cafe'),
      kebi('Streamer Coffee', {
        steps: [
          { id: 's1', status: 'done', title: 'reading your taste' },
          { id: 's2', status: 'done' }, // untitled step — dropped
        ],
        toolResults: [
          { tool: 'suggest_places', tool_call_id: 'c1', payload: { huge: 'blob' } },
          { tool: null, tool_call_id: null, payload: null },
        ],
      } as Partial<KebiTurn>),
    ];

    expect(toFeedbackTranscript(turns)).toEqual([
      { role: 'you', text: 'quiet cafe', at: '2026-07-19T12:00:00.000Z' },
      {
        role: 'kebi',
        text: 'Streamer Coffee',
        at: '2026-07-19T12:00:00.000Z',
        step_titles: ['reading your taste'],
        tool_names: ['suggest_places'],
      },
    ]);
  });

  it('keeps only the newest 20 turns and truncates long text', () => {
    const turns: ChatTurn[] = Array.from({ length: 25 }, (_, i) => you(`turn ${i}`, `u${i}`));
    turns.push(you('x'.repeat(600), 'long'));

    const result = toFeedbackTranscript(turns) ?? [];
    expect(result).toHaveLength(20);
    expect(result[0].text).toBe('turn 6');
    const last = result[result.length - 1];
    expect(last.text.length).toBe(500);
    expect(last.text.endsWith('…')).toBe(true);
  });

  it('drops empty kebi turns and returns undefined for an empty chat', () => {
    expect(toFeedbackTranscript([])).toBeUndefined();
    expect(toFeedbackTranscript([kebi('')])).toBeUndefined();
  });
});

describe('latestExchange', () => {
  it('pairs the last answered kebi turn with its preceding user turn', () => {
    const turns: ChatTurn[] = [
      you('first ask', 'u1'),
      kebi('first answer', {}, 'k1'),
      you('second ask', 'u2'),
      kebi('second answer', {}, 'k2'),
    ];

    expect(latestExchange(turns)).toEqual({ you: 'second ask', kebi: 'second answer' });
  });

  it('skips a trailing unanswered kebi turn (empty message)', () => {
    const turns: ChatTurn[] = [you('ask'), kebi('answer', {}, 'k1'), kebi('', {}, 'k2')];

    expect(latestExchange(turns)).toEqual({ you: 'ask', kebi: 'answer' });
  });

  it('returns undefined when nothing was answered', () => {
    expect(latestExchange([])).toBeUndefined();
    expect(latestExchange([you('hello?')])).toBeUndefined();
  });
});
