import { Fragment, memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import type { ChatEntity } from '@kebi-app/shared';

/**
 * kebi's answer text, rendered as blocks (ADR-136 — the prose IS the answer).
 *
 * kebi writes light markdown in two dimensions and this renders exactly those,
 * no more; it is deliberately not a general markdown parser:
 *
 * - **block level** — blank-line-separated paragraphs, and `- ` lines that form
 *   a bullet list. A real answer stacks five paragraphs and a five-item "skip
 *   for tonight" list, so both need real spacing and a hanging indent; a single
 *   `<Text>` renders them as an unreadable wall with literal `- ` markers.
 * - **inline** — `**bold**` spans and `[name](kebi://{kind}/{key})` entity
 *   links, resolved against the turn's `entities` by `uri`.
 *
 * A link is tappable but carries **no underline** — the answer names places
 * constantly, and underlining every one of them turns a paragraph into a field
 * of rules. The rail beneath the prose is where the affordance is spelled out;
 * inline, a place reads as part of the sentence and opens if you touch it.
 */

/** A blank line (with any trailing spaces) separates blocks. */
const BLOCK_SPLIT = /\n\s*\n/;
/** A bullet item: `- ` or `• ` at the start of a line. */
const BULLET_LINE = /^\s*[-•]\s+/;
/** Inline spans this renderer styles — everything else is plain text. */
const INLINE_MARKDOWN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(kebi:\/\/[^)]+\))/g;
const BOLD = /^\*\*([^*]+)\*\*$/;
const ENTITY_LINK = /^\[([^\]]+)\]\((kebi:\/\/[^)]+)\)$/;

export type InlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  /** `text` is the answer's own wording ("Luigi's"), `uri` resolves the entity. */
  | { kind: 'link'; text: string; uri: string };

export interface Block {
  kind: 'paragraph' | 'bullets';
  /** One entry for a paragraph; one per item for a bullet list. */
  lines: InlinePart[][];
}

/** Split one line into text / bold / link parts, in order. */
export function toInlineParts(line: string): InlinePart[] {
  return line
    .split(INLINE_MARKDOWN)
    .filter((part) => part !== '')
    .map((part): InlinePart => {
      const bold = BOLD.exec(part);
      if (bold) return { kind: 'bold', text: bold[1] };
      const link = ENTITY_LINK.exec(part);
      if (link) return { kind: 'link', text: link[1], uri: link[2] };
      return { kind: 'text', text: part };
    });
}

/**
 * Split the answer into paragraph and bullet blocks. Bullet lines are grouped
 * with their neighbours so one list renders as one block, and a paragraph that
 * merely *contains* a newline (a soft wrap from kebi) keeps that newline rather
 * than becoming two blocks — only a blank line starts a new one.
 */
export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  for (const chunk of text.split(BLOCK_SPLIT)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // Scoped to the chunk: a blank line always closes whatever was open, so two
    // blank-line-separated paragraphs stay two blocks.
    let open: { kind: Block['kind']; raw: string[] } | null = null;
    const raws: { kind: Block['kind']; raw: string[] }[] = [];

    for (const line of trimmed.split('\n')) {
      const isBullet = BULLET_LINE.test(line);
      const content = isBullet ? line.replace(BULLET_LINE, '') : line;
      if (!content.trim()) continue;

      const kind = isBullet ? 'bullets' : 'paragraph';
      // Extend the open block when it matches — a bullet run stays one block,
      // and the soft-wrapped lines of one paragraph stay one string.
      if (open && open.kind === kind) {
        if (isBullet) open.raw.push(content);
        else open.raw[open.raw.length - 1] += `\n${content}`;
        continue;
      }
      open = { kind, raw: [content] };
      raws.push(open);
    }

    for (const { kind, raw } of raws) {
      blocks.push({ kind, lines: raw.map(toInlineParts) });
    }
  }

  return blocks;
}

/**
 * The two text tiers of a turn (ADR-055). `answer` is the answer itself, at full
 * message size and contrast; `commentary` is the agent working — muted and a
 * step smaller, so a turn doesn't read as one long ramble. The `promote` flag is
 * the exact boundary: everything before it is commentary, everything from it on
 * is the answer.
 */
export type AnswerTier = 'answer' | 'commentary';

const LINE: Record<AnswerTier, string> = {
  answer: 'text-[17px] leading-relaxed text-text-muted',
  commentary: 'text-[15px] leading-relaxed text-text-soft',
};

interface ChatAnswerProps {
  message: string;
  /** The turn's entities — a link resolves against these by `uri`. */
  entities: ChatEntity[];
  /** Open the entity behind a tapped link. */
  onOpen: (entity: ChatEntity) => void;
  /** Text tier — defaults to the answer (full contrast). */
  tier?: AnswerTier;
}

/**
 * Memoized: the streaming turn re-renders on every answer token, and the
 * commentary segments above the answer have not changed — re-rendering them
 * re-runs NativeWind's class resolution for every paragraph on the screen.
 */
export const ChatAnswer = memo(function ChatAnswer({
  message,
  entities,
  onOpen,
  tier = 'answer',
}: ChatAnswerProps) {
  // `message` grows one `message_delta` at a time while the answer streams, so
  // this component re-renders per token — memoized so a growing answer costs one
  // parse per frame instead of re-splitting every earlier block along with it.
  const blocks = useMemo(() => toBlocks(message), [message]);
  const byUri = useMemo(
    () => new Map(entities.map((entity) => [entity.uri, entity])),
    [entities],
  );

  const renderLine = (parts: InlinePart[]) =>
    parts.map((part, i) => {
      if (part.kind === 'bold') {
        return (
          <Text key={i} className="font-semibold text-text">
            {part.text}
          </Text>
        );
      }
      if (part.kind === 'link') {
        const entity = byUri.get(part.uri);
        return (
          <Text
            key={i}
            className="font-semibold text-text"
            // An entity the turn didn't resolve isn't tappable — it still reads
            // as the answer's own wording rather than leaking the raw link.
            onPress={entity ? () => onOpen(entity) : undefined}
            accessibilityRole={entity ? 'link' : undefined}
          >
            {part.text}
          </Text>
        );
      }
      return <Fragment key={i}>{part.text}</Fragment>;
    });

  return (
    <View className="gap-3">
      {blocks.map((block, i) =>
        block.kind === 'paragraph' ? (
          <Text key={i} className={LINE[tier]}>
            {renderLine(block.lines[0])}
          </Text>
        ) : (
          <View key={i} className="gap-1.5">
            {block.lines.map((parts, j) => (
              // Hanging indent: the marker is its own column so a wrapped item
              // aligns under its text, not back under the marker.
              <View key={j} className="flex-row gap-2">
                <Text className={`${LINE[tier]} text-text-soft`}>·</Text>
                <Text className={`${LINE[tier]} flex-1`}>{renderLine(parts)}</Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
});
