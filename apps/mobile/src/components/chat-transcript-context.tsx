import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  ChatEntity,
  SseMessageDelta,
  SseReasoningDelta,
  SseReasoningStep,
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

export interface KebiTurn {
  key: string;
  role: 'kebi';
  /** Reasoning steps, upserted by id — fed straight into <ReasoningBlock>. */
  steps: ReasoningBlockStep[];
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
  | { type: 'UPSERT_STEP'; kebiKey: string; step: SseReasoningStep }
  | { type: 'APPEND_STEP_TEXT'; kebiKey: string; delta: SseReasoningDelta }
  | { type: 'APPEND_MESSAGE'; kebiKey: string; delta: SseMessageDelta }
  | { type: 'SET_MESSAGE'; kebiKey: string; content: string; entities: ChatEntity[] }
  | { type: 'FINISH'; kebiKey: string; toolCallsUsed: number; now: number }
  | { type: 'STOP'; kebiKey: string; now: number }
  | { type: 'FAIL'; kebiKey: string; detail: string }
  | { type: 'TOGGLE_COLLAPSE'; kebiKey: string; collapsed: boolean }
  | { type: 'CLEAR' }
  | { type: 'RESTORE'; turns: ChatTurn[] };

/**
 * Map an SSE reasoning step onto the presentational shape ReasoningBlock wants.
 *
 * `narration` (live `reasoning_delta` text) is carried over only while the step
 * is still `active`: the `done` frame supersedes whatever typed out, so dropping
 * it there is what makes the row settle onto its authoritative `summary`.
 */
function toBlockStep(step: SseReasoningStep, prev?: ReasoningBlockStep): ReasoningBlockStep {
  const next: ReasoningBlockStep = {
    id: step.id,
    status: step.status,
    title: step.title,
    summary: step.summary,
  };
  if (step.status === 'active' && prev?.narration) next.narration = prev.narration;
  return next;
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
        steps: [],
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
      return mapKebi(state, action.kebiKey, (turn) => {
        const idx = turn.steps.findIndex((s) => s.id === action.step.id);
        const next = toBlockStep(action.step, idx === -1 ? undefined : turn.steps[idx]);
        // Replace only the matched step (new object); keep every other step's
        // reference so the memoized StepRow doesn't re-run its animations.
        const steps =
          idx === -1
            ? [...turn.steps, next]
            : turn.steps.map((s, i) => (i === idx ? next : s));
        return { ...turn, steps };
      });
    }

    case 'APPEND_STEP_TEXT':
      // Live thinking text for a row already on screen. An id with no matching
      // row is a delta for a step the store dropped (debug) or never saw — skip
      // it rather than inventing a row the contract never announced.
      return mapKebi(state, action.kebiKey, (turn) => {
        const idx = turn.steps.findIndex((s) => s.id === action.delta.id);
        if (idx === -1) return turn;
        const steps = turn.steps.map((s, i) =>
          i === idx ? { ...s, narration: (s.narration ?? '') + action.delta.text } : s,
        );
        return { ...turn, steps };
      });

    case 'APPEND_MESSAGE':
      return mapKebi(state, action.kebiKey, (turn) => {
        if (!action.delta.promote) {
          return { ...turn, message: turn.message + action.delta.text };
        }
        // Promote: the text that had been typing into a thinking row IS the
        // start of the answer. This delta carries the full prefix, so the
        // bubble is SEEDED (not appended to) and the row's typed narration is
        // cleared — nothing the user read is lost, it moves. The row stays; its
        // `done` frame fills the summary.
        const steps = turn.steps.map((s) =>
          s.status === 'active' && s.narration ? { ...s, narration: undefined } : s,
        );
        return { ...turn, steps, message: action.delta.text };
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
  /** Append live thinking text to the `active` step the delta's `id` names. */
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
    dispatch({ type: 'UPSERT_STEP', kebiKey, step });
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
