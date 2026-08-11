import { View, Text, Pressable } from 'react-native';
import type { ChatEntity } from '@kebi-app/shared';
import { ChatAnswer } from './chat-answer';
import { Chevron, Collapsible, LiveDot, ReasoningBlock } from './reasoning-block';
import type { TurnSegment } from './chat-transcript-context';

/**
 * Everything a turn did before it answered — the agent's commentary and the work
 * chips between it — with two lives (ADR-055):
 *
 * - **While it streams**, the process plays live and interleaved: prose the
 *   agent is typing, chips for the tools it runs, in arrival order. Each chip
 *   carries its own "thought for 0.5s" micro-header.
 * - **Once it settles**, all of it folds behind a single `▸ thought for 12s`
 *   header, leaving the settled transcript as one line plus a clean answer.
 *   Tapping reopens the same interleaved process, micro-headers and all.
 *
 * The answer itself is NOT in here — it renders after, at full contrast, so the
 * boundary the `promote` flag marks is also the boundary on screen.
 */

export interface TurnProcessLabels {
  /** Header while the turn is still working, e.g. "thinking". */
  thinking: string;
  /** Settled header prefix, e.g. "thought for" — the total is appended. */
  thought: string;
  /** Settled header prefix when the user stopped the turn early. */
  stopped: string;
  /** Detail on a step that never finished. */
  interrupted: string;
}

export interface TurnProcessProps {
  segments: TurnSegment[];
  /** The turn finished (`done`/`error`/stopped) — fold into one header. */
  settled: boolean;
  /** The user stopped it — the header says so instead of "thought for". */
  stopped?: boolean;
  /** Total thinking time: summed step durations, else the turn's wall-clock. */
  durationMs?: number;
  /** Collapsed state of the settled header (controlled by the transcript). */
  collapsed: boolean;
  onToggle: (next: boolean) => void;
  labels: TurnProcessLabels;
  onOpenEntity: (entity: ChatEntity) => void;
}

/** Prose segments carry no entities — links only ride the final `message` frame. */
const NO_ENTITIES: ChatEntity[] = [];

export function TurnProcess({
  segments,
  settled,
  stopped = false,
  durationMs,
  collapsed,
  onToggle,
  labels,
  onOpenEntity,
}: TurnProcessProps) {
  const hasContent = segments.some((s) => (s.kind === 'work' ? s.steps.length > 0 : s.text !== ''));
  if (!hasContent) return null;

  const body = (
    <View className="gap-2">
      {segments.map((segment) =>
        segment.kind === 'work' ? (
          <ReasoningBlock
            key={segment.key}
            steps={segment.steps}
            done={settled || segment.steps.every((s) => s.status === 'done')}
            durationMs={segment.endedAt != null ? segment.endedAt - segment.startedAt : undefined}
            runningLabel={labels.thinking}
            doneLabel={labels.thought}
            interruptedLabel={labels.interrupted}
            collapsed={false}
            // Once settled, the turn's own header owns the disclosure, so the
            // chips drop theirs and the expanded process is just prose and work
            // rows in order. While it runs, the header IS the live affordance.
            bare={settled}
          />
        ) : segment.text ? (
          // Commentary tier: the agent working, not the answer. Plain prose —
          // never linkified client-side; only the final frame carries links.
          <ChatAnswer
            key={segment.key}
            message={segment.text}
            entities={NO_ENTITIES}
            onOpen={onOpenEntity}
            tier="commentary"
          />
        ) : null,
      )}
    </View>
  );

  // Still working: the process IS the content, so it plays in place.
  if (!settled) return <View className="mb-1 gap-2">{body}</View>;

  const seconds = durationMs != null ? ` ${Math.max(durationMs / 1000, 0.1).toFixed(1)}s` : '';
  const header = `${stopped ? labels.stopped : labels.thought}${stopped ? '' : seconds}`;

  return (
    <View className="mb-1 gap-2">
      <Pressable
        onPress={() => onToggle(!collapsed)}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={header}
        className="flex-row items-center justify-between gap-2.5"
      >
        <View className="min-w-0 flex-row items-center gap-2">
          <LiveDot done />
          <Text
            numberOfLines={1}
            className="shrink text-[12px] font-medium lowercase text-text-muted"
          >
            {header}
          </Text>
        </View>
        <Chevron expanded={!collapsed} />
      </Pressable>

      <Collapsible collapsed={collapsed}>{body}</Collapsible>
    </View>
  );
}
