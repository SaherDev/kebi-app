import type { FeedbackRequestDto, FeedbackTranscriptTurnDto } from './dto/feedback-request.dto';
import { buildFeedbackPage } from './notion-page';

const NOW = new Date('2026-07-19T12:00:00Z');

function build(dto: Partial<FeedbackRequestDto>, email?: string) {
  return buildFeedbackPage({
    databaseId: 'db_123',
    userId: 'user_1',
    email,
    dto: dto as FeedbackRequestDto,
    now: NOW,
  });
}

function turn(overrides: Partial<FeedbackTranscriptTurnDto> = {}): FeedbackTranscriptTurnDto {
  return { role: 'you', text: 'hello', at: '2026-07-19T11:00:00Z', ...overrides };
}

type RichTextPayload = { rich_text: { text: { content: string } }[] };
type TitleProperty = { title: { text: { content: string } }[] };
type TextProperty = { rich_text: { text: { content: string } }[] };

function plainText(block: Record<string, unknown>): string {
  const payload = block[block['type'] as string] as RichTextPayload;
  return payload.rich_text.map((r) => r.text.content).join('');
}

function propText(prop: unknown): string {
  return (prop as TextProperty).rich_text[0].text.content;
}

describe('buildFeedbackPage', () => {
  it('sets properties: title, kind, status new, user; email only when present', () => {
    const page = build({ kind: 'bug', text: 'crash' }, 'saher@example.com');

    expect(page.parent).toEqual({ database_id: 'db_123' });
    expect(page.properties['kind']).toEqual({ select: { name: 'bug' } });
    expect(page.properties['status']).toEqual({ select: { name: 'new' } });
    expect(page.properties['email']).toEqual({ email: 'saher@example.com' });
    expect((page.properties['title'] as TitleProperty).title[0].text.content).toBe(
      'bug · 2026-07-19',
    );

    const anonymous = build({ kind: 'bug', text: 'crash' });
    expect(anonymous.properties['email']).toBeUndefined();
  });

  it('carries app version, platform, os, and device when provided', () => {
    const page = build({
      kind: 'bug',
      text: 'crash',
      app_version: '1.0.0',
      platform: 'ios',
      os_version: '18.5',
      device: 'iPhone 15 Pro',
    });

    expect(page.properties['platform']).toEqual({ select: { name: 'ios' } });
    expect(propText(page.properties['app version'])).toBe('1.0.0');
    expect(propText(page.properties['os'])).toBe('18.5');
    expect(propText(page.properties['device'])).toBe('iPhone 15 Pro');
  });

  it('wrong_answer includes category, quoted exchange, and transcript blocks', () => {
    const page = build({
      kind: 'wrong_answer',
      text: 'somewhere quiet',
      category: 'wrong_place',
      exchange: { you: 'quiet cafe', kebi: 'Streamer Coffee' },
      transcript: [
        turn({ role: 'you', text: 'quiet cafe' }),
        turn({
          role: 'kebi',
          text: 'Streamer Coffee',
          step_titles: ['reading your taste', 'checking saved'],
          tool_names: ['suggest_places'],
        }),
      ],
    });

    expect(page.properties['category']).toEqual({ select: { name: 'wrong_place' } });
    const texts = page.children.map((b) => (b['type'] === 'divider' ? '---' : plainText(b)));
    expect(texts).toContain('you: quiet cafe\nkebi: Streamer Coffee');
    expect(texts).toContain('transcript');
    expect(texts).toContain(
      'kebi: Streamer Coffee (steps: reading your taste → checking saved · tools: suggest_places)',
    );
  });

  it('extraction reports quote the saved input', () => {
    const page = build({
      kind: 'extraction',
      text: 'it saved a ramen place, the video was a cocktail bar',
      input: 'https://www.tiktok.com/@tokyo/video/123',
    });

    const texts = page.children.map((b) => (b['type'] === 'divider' ? '---' : plainText(b)));
    expect(texts[0]).toBe('what went wrong with the save');
    expect(texts).toContain('input: https://www.tiktok.com/@tokyo/video/123');
  });

  it('extraction reports render each recorded save attempt', () => {
    const page = build({
      kind: 'extraction',
      text: 'no candidates but the video names the place',
      save_attempts: [
        { input: 'https://www.tiktok.com/@a/video/1', result: 'saved: Bar Trench', at: '2026-07-19T11:00:00Z' },
        { input: 'gibberish input', result: 'failed: no_candidates', at: '2026-07-19T11:05:00Z' },
      ],
    });

    const texts = page.children.map((b) => (b['type'] === 'divider' ? '---' : plainText(b)));
    expect(texts).toContain('recent saves');
    expect(texts).toContain('sent: https://www.tiktok.com/@a/video/1\ngot: saved: Bar Trench');
    expect(texts).toContain('sent: gibberish input\ngot: failed: no_candidates');
  });

  it('bug and message reports carry no transcript machinery', () => {
    const page = build({ kind: 'message', text: 'love the app' });

    const types = page.children.map((b) => b['type']);
    expect(types).toEqual(['heading_3', 'paragraph']);
  });

  it('wrong_answer without a transcript gets the "no transcript" callout', () => {
    const page = build({ kind: 'wrong_answer', category: 'missing_info' });

    const last = page.children[page.children.length - 1];
    expect(last['type']).toBe('callout');
    expect(plainText(last)).toBe('no transcript attached');
    // Chip-only report: text paragraph falls back to the category-only marker.
    expect(plainText(page.children[1])).toBe('(no text — category only)');
  });

  it('truncates long turn text and drops oldest turns over the block budget', () => {
    const long = 'x'.repeat(600);
    const many = Array.from({ length: 70 }, (_, i) => turn({ text: `turn ${i}` }));
    many.push(turn({ text: long }));

    const page = build({ kind: 'wrong_answer', text: 'expected', transcript: many });

    const texts = page.children.filter((b) => b['type'] !== 'divider').map(plainText);
    expect(texts).toContain('11 earlier turns omitted');
    expect(texts).not.toContain('you: turn 0');
    const truncated = texts.find((t) => t.startsWith('you: xxx')) ?? '';
    expect(truncated.length).toBeGreaterThan(0);
    expect(truncated.length).toBeLessThanOrEqual('you: '.length + 500);
    expect(truncated.endsWith('…')).toBe(true);
    // Stay under Notion's create-page children limit.
    expect(page.children.length).toBeLessThanOrEqual(100);
  });
});
