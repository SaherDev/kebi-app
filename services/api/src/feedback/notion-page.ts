import type { FeedbackKind } from '@kebi-app/shared';
import type { FeedbackRequestDto, FeedbackTranscriptTurnDto } from './dto/feedback-request.dto';

/** Notion REST API version header value. */
export const NOTION_VERSION = '2022-06-28';

// Notion protocol limits (not tunables): 2000 chars per rich_text object and
// 100 children per create-page request. Constants stay under both with headroom.
const RICH_TEXT_CHAR_MAX = 1900;
const TURN_CHAR_MAX = 500;
const MAX_TRANSCRIPT_BLOCKS = 60;

interface RichText {
  type: 'text';
  text: { content: string };
}

interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: unknown;
}

export interface NotionPageBody {
  parent: { database_id: string };
  properties: Record<string, unknown>;
  children: NotionBlock[];
}

const KIND_HEADINGS: Record<FeedbackKind, string> = {
  wrong_answer: 'what they expected',
  bug: 'what happened',
  message: 'message',
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function rt(text: string): RichText[] {
  return [{ type: 'text', text: { content: truncate(text, RICH_TEXT_CHAR_MAX) } }];
}

function paragraph(text: string): NotionBlock {
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: rt(text) } };
}

function heading(text: string): NotionBlock {
  return { object: 'block', type: 'heading_3', heading_3: { rich_text: rt(text) } };
}

function callout(text: string): NotionBlock {
  return { object: 'block', type: 'callout', callout: { rich_text: rt(text) } };
}

function turnLine(turn: FeedbackTranscriptTurnDto): string {
  const text = truncate(turn.text, TURN_CHAR_MAX);
  const meta: string[] = [];
  if (turn.step_titles?.length) meta.push(`steps: ${turn.step_titles.join(' → ')}`);
  if (turn.tool_names?.length) meta.push(`tools: ${turn.tool_names.join(', ')}`);
  return meta.length ? `${turn.role}: ${text} (${meta.join(' · ')})` : `${turn.role}: ${text}`;
}

function transcriptBlocks(transcript: FeedbackTranscriptTurnDto[]): NotionBlock[] {
  // Newest turns matter most — when over budget, drop the oldest and say so.
  const kept = transcript.slice(-MAX_TRANSCRIPT_BLOCKS);
  const omitted = transcript.length - kept.length;
  const blocks: NotionBlock[] = [
    { object: 'block', type: 'divider', divider: {} },
    heading('transcript'),
  ];
  if (omitted > 0) blocks.push(callout(`${omitted} earlier turns omitted`));
  for (const turn of kept) blocks.push(paragraph(turnLine(turn)));
  return blocks;
}

/**
 * Builds the Notion create-page request for one feedback report (ADR-051).
 * Pure — everything variable (identity, time) comes in as arguments. The email
 * property is omitted when the token carried no email (dev-bypass path).
 */
export function buildFeedbackPage(params: {
  databaseId: string;
  userId: string;
  email: string | undefined;
  dto: FeedbackRequestDto;
  now: Date;
}): NotionPageBody {
  const { databaseId, userId, email, dto, now } = params;

  const properties: Record<string, unknown> = {
    title: { title: rt(`${dto.kind} · ${now.toISOString().slice(0, 10)}`) },
    kind: { select: { name: dto.kind } },
    status: { select: { name: 'new' } },
    user: { rich_text: rt(userId) },
  };
  if (email) properties['email'] = { email };
  if (dto.category) properties['category'] = { select: { name: dto.category } };
  if (dto.app_version) properties['app version'] = { rich_text: rt(dto.app_version) };
  if (dto.platform) properties['platform'] = { select: { name: dto.platform } };
  if (dto.os_version) properties['os'] = { rich_text: rt(dto.os_version) };
  if (dto.device) properties['device'] = { rich_text: rt(dto.device) };

  const children: NotionBlock[] = [
    heading(KIND_HEADINGS[dto.kind]),
    paragraph(dto.text ?? '(no text — category only)'),
  ];

  if (dto.exchange) {
    children.push({
      object: 'block',
      type: 'quote',
      quote: { rich_text: rt(`you: ${dto.exchange.you}\nkebi: ${dto.exchange.kebi}`) },
    });
  }

  if (dto.kind === 'wrong_answer') {
    if (dto.transcript?.length) {
      children.push(...transcriptBlocks(dto.transcript));
    } else {
      children.push(callout('no transcript attached'));
    }
  }

  return { parent: { database_id: databaseId }, properties, children };
}
