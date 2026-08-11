import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import {
  isAgentTalkStep,
  type ChatEntity,
  type SseMessageDelta,
  type SseReasoningDelta,
  type SseReasoningStep,
} from '@kebi-app/shared';
import type { ReasoningBlockStep } from './reasoning-block';

/**
 * Chat transcript store. A `ChatTranscriptProvider` holds the conversation for
 * the app session; `useChatTranscript()` exposes the turns and the actions the
 * chat screen dispatches as a stream arrives. Mirrors the saved-places provider
 * pattern (provider + hook + no-op fallback + monotonic key ref) — the repo has
 * no state library — but uses a reducer because the upsert/collapse logic is
 * non-trivial and unit-tested in isolation.
 *
 * It is mounted ABOVE `ChatProvider` (see app/_layout.tsx) so the transcript
 * survives the chat overlay close→reopen (the overlay unmounts its child); it
 * resets on app restart (in-memory only, like SavedPlacesProvider). Holds real
 * streamed data, not fixtures (ADR-041).
 */

export type ChatTurnStatus = 'streaming' | 'done' | 'error';

export interface UserTurn {
  key: string;
  role: 'you';
  text: string;
  at: number;
}

/**
 * One piece of a kebi turn's body, in stream order. A turn reads as an
 * interleaving of the agent's own sentences and the work it did between them:
 *
 * ```
 * ● thought for 2s ▸        ← a `work` segment (collapsed chip of tool rows)
 * gili t for the weekend…   ← a `prose` segment (the agent talking)
 * ● thought for 1s ▸        ← more work
 * okay, nothing saved…      ← more talk, which flows into the answer
 * ```
 *
 * The answer itself is not a segment: it lives on `message` and always renders
 * last, directly after the final prose segment — which is what makes `promote`
 * a no-op visually (the words are in the same place, they just stop being
 * "thinking" and start being the answer).
 */
export type TurnSegment =
  | {
      kind: 'prose';
      key: string;
      /** The `agent.tool_decision` step whose deltas (or summary) wrote this. */
      stepId: string;
      text: string;
      /** This segment's text became the answer — its `done` summary is dropped. */
      promoted?: boolean;
    }
  | {
      kind: 'work';
      key: string;
      /** Tool rows, upserted by id — fed straight into <ReasoningBlock>. */
      steps: ReasoningBlockStep[];
      /** Wall-clock bounds of this chip's work, for its "thought for 2s". */
      startedAt: number;
      endedAt?: number;
    };

export interface KebiTurn {
  key: string;
  role: 'kebi';
  /** Prose the agent said + the work it did, interleaved in arrival order. */
  segments: TurnSegment[];
  /** Assistant text. While the answer streams this is the accumulated
   *  `message_delta` prose (plain, link-free); the final `message` frame
   *  replaces it wholesale with content whose entity names are markdown links
   *  to `kebi://{kind}/{key}` (ADR-136). */
  message: string;
  /** One per link in `message`, resolving what a tap opens. */
  entities: ChatEntity[];
  status: ChatTurnStatus;
  /** The user tapped "stop" — the turn finished early, not a natural completion. */
  stopped?: boolean;
  /** From an `error` frame / a thrown transport error. */
  errorDetail?: string;
  startedAt: number;
  /** Set on finish — summed step `duration_ms` when all present, else wall-clock. */
  durationMs?: number;
  toolCallsUsed?: number;
  /** Reasoning-block collapse (controlled) — auto-set true when a new turn starts. */
  collapsed: boolean;
  at: number;
}

export type ChatTurn = UserTurn | KebiTurn;

interface TranscriptState {
  turns: ChatTurn[];
}

type Action =
  | { type: 'START_TURN'; text: string; userKey: string; kebiKey: string; at: number }
  | { type: 'UPSERT_STEP'; kebiKey: string; step: SseReasoningStep; now: number }
  | { type: 'APPEND_STEP_TEXT'; kebiKey: string; delta: SseReasoningDelta }
  | { type: 'APPEND_MESSAGE'; kebiKey: string; delta: SseMessageDelta }
  | { type: 'SET_MESSAGE'; kebiKey: string; content: string; entities: ChatEntity[] }
  | { type: 'FINISH'; kebiKey: string; toolCallsUsed: number; now: number }
  | { type: 'STOP'; kebiKey: string; now: number }
  | { type: 'FAIL'; kebiKey: string; detail: string }
  | { type: 'TOGGLE_COLLAPSE'; kebiKey: string; collapsed: boolean }
  | { type: 'CLEAR' }
  | { type: 'RESTORE'; turns: ChatTurn[] };

/** Map an SSE reasoning step onto the presentational shape ReasoningBlock wants. */
function toBlockStep(step: SseReasoningStep): ReasoningBlockStep {
  return { id: step.id, status: step.status, title: step.title, summary: step.summary };
}

type ProseSegment = Extract<TurnSegment, { kind: 'prose' }>;
type WorkSegment = Extract<TurnSegment, { kind: 'work' }>;

/** Index of the last match, or -1 (`Array.findLastIndex` needs a newer lib target). */
function lastIndex(segments: TurnSegment[], match: (s: TurnSegment) => boolean): number {
  for (let i = segments.length - 1; i >= 0; i -= 1) if (match(segments[i])) return i;
  return -1;
}

/** Replace segment `idx`, leaving every other segment's reference untouched. */
function withSegment(turn: KebiTurn, idx: number, segment: TurnSegment): KebiTurn {
  const segments = turn.segments.slice();
  segments[idx] = segment;
  return { ...turn, segments };
}

/**
 * Fold an `agent.tool_decision` frame into the turn's prose.
 *
 * The `active` frame opens an empty segment for the deltas to fill; the `done`
 * frame supersedes whatever typed out with its authoritative `summary` — unless
 * the segment was promoted, in which case those words are already the answer
 * and writing them back here would print the sentence twice.
 */
function foldTalkStep(turn: KebiTurn, step: SseReasoningStep): KebiTurn {
  const idx = turn.segments.findIndex((s) => s.kind === 'prose' && s.stepId === step.id);
  if (idx === -1) {
    const segment: ProseSegment = {
      kind: 'prose',
      key: `${turn.key}-seg${turn.segments.length}`,
      stepId: step.id,
      text: '',
    };
    return { ...turn, segments: [...turn.segments, segment] };
  }
  const prev = turn.segments[idx] as ProseSegment;
  if (step.status !== 'done' || step.summary === null || prev.promoted) return turn;
  return withSegment(turn, idx, { ...prev, text: step.summary });
}

/**
 * Fold a work (non-talk) frame into the turn's chips.
 *
 * Rows group into the trailing chip so consecutive work reads as one "thought
 * for 2s"; prose arriving between them closes the chip and the next row opens a
 * new one. A late `done` frame still finds the row in whichever chip already
 * holds it, rather than opening a duplicate chip for the same step.
 */
function foldWorkStep(turn: KebiTurn, step: SseReasoningStep, now: number): KebiTurn {
  const next = toBlockStep(step);

  const owner = turn.segments.findIndex(
    (s) => s.kind === 'work' && s.steps.some((row) => row.id === next.id),
  );
  if (owner !== -1) {
    const chip = turn.segments[owner] as WorkSegment;
    // Replace only the matched row (new object); keep every other row's
    // reference so the memoized StepRow doesn't re-run its animations.
    const steps = chip.steps.map((row) => (row.id === next.id ? next : row));
    return withSegment(turn, owner, { ...chip, steps, endedAt: now });
  }

  const lastIdx = turn.segments.length - 1;
  const last = turn.segments[lastIdx];
  if (last?.kind === 'work') {
    return withSegment(turn, lastIdx, { ...last, steps: [...last.steps, next], endedAt: now });
  }

  const chip: WorkSegment = {
    kind: 'work',
    key: `${turn.key}-seg${turn.segments.length}`,
    steps: [next],
    startedAt: now,
    endedAt: now,
  };
  return { ...turn, segments: [...turn.segments, chip] };
}

/** Apply `fn` to the kebi turn with `key`, leaving every other turn untouched. */
function mapKebi(
  state: TranscriptState,
  key: string,
  fn: (turn: KebiTurn) => KebiTurn,
): TranscriptState {
  return {
    turns: state.turns.map((turn) =>
      turn.role === 'kebi' && turn.key === key ? fn(turn) : turn,
    ),
  };
}

function reducer(state: TranscriptState, action: Action): TranscriptState {
  switch (action.type) {
    case 'START_TURN': {
      // Collapse the previous kebi turn's reasoning when a new turn begins
      // (mockup: a finished block auto-collapses on the next user turn).
      const collapsed = state.turns.map((turn) =>
        turn.role === 'kebi' && !turn.collapsed ? { ...turn, collapsed: true } : turn,
      );
      const user: UserTurn = { key: action.userKey, role: 'you', text: action.text, at: action.at };
      const kebi: KebiTurn = {
        key: action.kebiKey,
        role: 'kebi',
        segments: [],
        message: '',
        entities: [],
        status: 'streaming',
        startedAt: action.at,
        collapsed: false,
        at: action.at,
      };
      return { turns: [...collapsed, user, kebi] };
    }

    case 'UPSERT_STEP': {
      // Debug steps ride the stream but never render (ADR-102) — the store owns
      // this policy, not the parser.
      if (action.step.visibility === 'debug') return state;
      return mapKebi(state, action.kebiKey, (turn) =>
        isAgentTalkStep(action.step)
          ? foldTalkStep(turn, action.step)
          : foldWorkStep(turn, action.step, action.now),
      );
    }

    case 'APPEND_STEP_TEXT':
      // The agent talking, live. An id with no open segment is a delta for a
      // step the store dropped (debug) or never saw — skip it rather than
      // inventing prose the contract never announced.
      return mapKebi(state, action.kebiKey, (turn) => {
        const idx = turn.segments.findIndex(
          (s) => s.kind === 'prose' && s.stepId === action.delta.id,
        );
        if (idx === -1) return turn;
        const prev = turn.segments[idx] as ProseSegment;
        return withSegment(turn, idx, { ...prev, text: prev.text + action.delta.text });
      });

    case 'APPEND_MESSAGE':
      return mapKebi(state, action.kebiKey, (turn) => {
        if (!action.delta.promote) {
          return { ...turn, message: turn.message + action.delta.text };
        }
        // Promote: the sentence that had been typing as prose IS the start of
        // the answer. This delta carries the full prefix, so the answer is
        // SEEDED with it and the segment it came from is emptied — the same
        // words, in the same place on screen, now the answer. Nothing moves.
        // The segment stays (flagged) so its `done` frame can't re-add them.
        const idx = lastIndex(turn.segments, (s) => s.kind === 'prose' && s.text !== '');
        const seeded = { ...turn, message: action.delta.text };
        if (idx === -1) return seeded;
        const prev = turn.segments[idx] as ProseSegment;
        return withSegment(seeded, idx, { ...prev, text: '', promoted: true });
      });

    case 'SET_MESSAGE':
      // Authoritative — a wholesale replace of whatever streamed, never a diff
      // or append. Same words; the links are what's new.
      return mapKebi(state, action.kebiKey, (turn) => ({
        ...turn,
        message: action.content,
        entities: action.entities,
      }));

    case 'FINISH':
      return mapKebi(state, action.kebiKey, (turn) => {
        if (turn.status !== 'streaming') return turn;
        // Wall-clock since the turn started — the honest turn time, and what the
        // mockup's "· 1.8s" tally shows. (ReasoningBlockStep drops per-step
        // duration_ms, so there's nothing to sum here.)
        const durationMs = action.now - turn.startedAt;
        return { ...turn, status: 'done', durationMs, toolCallsUsed: action.toolCallsUsed };
      });

    case 'STOP':
      // User cancelled — finish the turn (keep what streamed) and flag it stopped
      // so the reasoning header reads "stopped" instead of "done".
      return mapKebi(state, action.kebiKey, (turn) =>
        turn.status === 'streaming'
          ? { ...turn, status: 'done', stopped: true, durationMs: action.now - turn.startedAt }
          : turn,
      );

    case 'FAIL':
      return mapKebi(state, action.kebiKey, (turn) =>
        turn.status === 'streaming'
          ? { ...turn, status: 'error', errorDetail: action.detail }
          : turn,
      );

    case 'TOGGLE_COLLAPSE':
      return mapKebi(state, action.kebiKey, (turn) => ({ ...turn, collapsed: action.collapsed }));

    case 'CLEAR':
      return { turns: [] };

    case 'RESTORE':
      // Undo of a clear — put the snapshot back BEFORE any turns sent since
      // (keys never collide: the provider's key counter isn't reset by CLEAR).
      return { turns: [...action.turns, ...state.turns] };

    default:
      return state;
  }
}

export interface ChatTranscriptValue {
  turns: ChatTurn[];
  /** Append a user turn + an empty streaming kebi turn; returns the kebi key. */
  startTurn: (text: string) => string;
  upsertStep: (kebiKey: string, step: SseReasoningStep) => void;
  /** Append the agent's live talk to the prose segment the delta's `id` names. */
  appendStepText: (kebiKey: string, delta: SseReasoningDelta) => void;
  /** Append (or, on `promote`, seed) the streaming answer text. */
  appendMessage: (kebiKey: string, delta: SseMessageDelta) => void;
  /** Final `message` frame — replaces the streamed text wholesale. */
  setMessage: (kebiKey: string, content: string, entities: ChatEntity[]) => void;
  finishTurn: (kebiKey: string, toolCallsUsed: number) => void;
  /** User cancelled the stream — finish the turn and mark it stopped. */
  stopTurn: (kebiKey: string) => void;
  failTurn: (kebiKey: string, detail: string) => void;
  toggleCollapse: (kebiKey: string, collapsed: boolean) => void;
  /** Empty the transcript (clear chat history). Snapshot `turns` first for undo. */
  clearTranscript: () => void;
  /** Undo a clear — prepends the snapshot before any turns sent since. */
  restoreTranscript: (turns: ChatTurn[]) => void;
}

const fallback: ChatTranscriptValue = {
  turns: [],
  startTurn: () => '',
  upsertStep: () => undefined,
  appendStepText: () => undefined,
  appendMessage: () => undefined,
  setMessage: () => undefined,
  finishTurn: () => undefined,
  stopTurn: () => undefined,
  failTurn: () => undefined,
  toggleCollapse: () => undefined,
  clearTranscript: () => undefined,
  restoreTranscript: () => undefined,
};

const ChatTranscriptContext = createContext<ChatTranscriptValue>(fallback);

export function ChatTranscriptProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { turns: [] });
  // Monotonic client key counter (mirrors saved-places/toast id refs).
  const keyRef = useRef(0);

  const startTurn = useCallback((text: string) => {
    const n = (keyRef.current += 1);
    const userKey = `you-${n}`;
    const kebiKey = `kebi-${n}`;
    dispatch({ type: 'START_TURN', text, userKey, kebiKey, at: Date.now() });
    return kebiKey;
  }, []);

  const upsertStep = useCallback((kebiKey: string, step: SseReasoningStep) => {
    dispatch({ type: 'UPSERT_STEP', kebiKey, step, now: Date.now() });
  }, []);

  const appendStepText = useCallback((kebiKey: string, delta: SseReasoningDelta) => {
    dispatch({ type: 'APPEND_STEP_TEXT', kebiKey, delta });
  }, []);

  const appendMessage = useCallback((kebiKey: string, delta: SseMessageDelta) => {
    dispatch({ type: 'APPEND_MESSAGE', kebiKey, delta });
  }, []);

  const setMessage = useCallback(
    (kebiKey: string, content: string, entities: ChatEntity[]) => {
      dispatch({ type: 'SET_MESSAGE', kebiKey, content, entities });
    },
    [],
  );

  const finishTurn = useCallback((kebiKey: string, toolCallsUsed: number) => {
    dispatch({ type: 'FINISH', kebiKey, toolCallsUsed, now: Date.now() });
  }, []);

  const stopTurn = useCallback((kebiKey: string) => {
    dispatch({ type: 'STOP', kebiKey, now: Date.now() });
  }, []);

  const failTurn = useCallback((kebiKey: string, detail: string) => {
    dispatch({ type: 'FAIL', kebiKey, detail });
  }, []);

  const toggleCollapse = useCallback((kebiKey: string, collapsed: boolean) => {
    dispatch({ type: 'TOGGLE_COLLAPSE', kebiKey, collapsed });
  }, []);

  const clearTranscript = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const restoreTranscript = useCallback((turns: ChatTurn[]) => {
    dispatch({ type: 'RESTORE', turns });
  }, []);

  const value = useMemo<ChatTranscriptValue>(
    () => ({
      turns: state.turns,
      startTurn,
      upsertStep,
      appendStepText,
      appendMessage,
      setMessage,
      finishTurn,
      stopTurn,
      failTurn,
      toggleCollapse,
      clearTranscript,
      restoreTranscript,
    }),
    [state.turns, startTurn, upsertStep, appendStepText, appendMessage, setMessage, finishTurn, stopTurn, failTurn, toggleCollapse, clearTranscript, restoreTranscript],
  );

  return <ChatTranscriptContext.Provider value={value}>{children}</ChatTranscriptContext.Provider>;
}

/** Read / drive the chat transcript from anywhere under a ChatTranscriptProvider. */
export function useChatTranscript(): ChatTranscriptValue {
  return useContext(ChatTranscriptContext);
}
