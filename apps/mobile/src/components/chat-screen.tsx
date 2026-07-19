import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnstableNativeVariable } from 'nativewind';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import { TopBar } from './top-bar';
import { IconButton } from './icon-button';
import { Icon } from './icon';
import { Mascot } from './mascot';
import { ActionSheet } from './action-sheet';
import { ReasoningBlock } from './reasoning-block';
import { PlaceCardSkeleton } from './place-card-skeleton';
import { ChatPlaceCard } from './chat-place-card';
import { hasConsultResults, hasPlaceCandidates } from './chat-place-card-data';
import {
  useChatTranscript,
  type ChatTranscriptValue,
  type ChatTurn,
  type KebiTurn,
  type UserTurn,
} from './chat-transcript-context';
import { useApiClient } from '../api/hooks';
import { streamChat } from '../api/chat';
import { deleteUserData } from '../api/user-data';
import { TOAST_DISMISS_MS } from '../theme/motion';
import { getDeviceLocation } from '../lib/location';
import { formatClockTime } from '../lib/format-relative-time';
import { triggerHaptic } from '../lib/haptics';
import { useToast } from './toast-context';
import { useUpgradeToast } from './use-upgrade-toast';
import { useTranslation } from '../i18n/context';

interface ChatScreenProps {
  /** Close the chat — runs the collapse-back-into-the-button animation. */
  onClose: () => void;
  /** Optional first message auto-sent once on mount (a home chip / recall row). */
  seed?: string;
}

/**
 * The chat surface (kebi-chat-mockup). Rendered inside the circular-reveal
 * overlay (`ChatOverlay`), not as a routed screen — home stays mounted behind
 * it. The header X is the only close trigger; it calls `onClose`, which plays
 * the reverse wipe. The frame is inlined (not `ScreenScaffold`) so there's no
 * FAB and no import cycle through the scaffold — you're already in chat.
 *
 * It owns the send→stream loop: on submit it captures device coordinates,
 * appends a turn to the session transcript (which lives above the overlay so it
 * survives close→reopen), opens the SSE stream, and dispatches each frame into
 * the transcript store — reasoning steps drive `ReasoningBlock`, the message
 * frame fills the answer, tool results stash a place-card skeleton (Task 2 will
 * render the real card). Bottom is a photo/mic toolbar pill (no AI button).
 */
export function ChatScreen({ onClose, seed }: ChatScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;
  const client = useApiClient();
  const { show: showToast, reserveTopAnchor } = useToast();
  const showUpgrade = useUpgradeToast();
  const transcript = useChatTranscript();
  const { turns, startTurn, upsertStep, setMessage, addToolResult, finishTurn, stopTurn, failTurn, toggleCollapse, clearTranscript, restoreTranscript } =
    transcript;

  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  // Stable across renders so the memoized TurnRow isn't invalidated each frame.
  const turnLabels = useMemo(() => labels(t), [t]);
  const listRef = useRef<FlatList<ChatTurn>>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Only auto-scroll when the user is already at the bottom — don't yank the
  // list down while they've scrolled up to read an earlier turn.
  const atBottomRef = useRef(true);

  // Abort an in-flight stream when the chat closes (the overlay unmounts us).
  // The transcript persists above, so a partial turn stays visible on reopen.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Route toasts to the top while chat is open — the bottom spot is covered by
  // the composer and (often) the keyboard, so a bottom toast would be hidden.
  useEffect(() => reserveTopAnchor(), [reserveTopAnchor]);

  // Auto-send a seed message once — a home quick-prompt chip or a "what you
  // wanted" row opens the chat with an intent already in hand. `seededRef`
  // guards against a re-mount / StrictMode double-invoke firing it twice.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seed && !seededRef.current) {
      seededRef.current = true;
      void submit(seed);
    }
    // `submit` is recreated each render; the ref guard (not the dep list) is what
    // keeps this single-shot, so depend on `seed` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const keyboard = useAnimatedKeyboard();
  const bottomPad = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom),
  }));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    atBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
  };
  const onContentSizeChange = () => {
    if (atBottomRef.current) listRef.current?.scrollToEnd({ animated: !reducedMotion });
  };

  // The composer button is "send" normally and "stop" while a turn streams —
  // derived from the last turn so it tracks the store (no separate flag to drift).
  const last = turns[turns.length - 1];
  const isStreaming = last?.role === 'kebi' && last.status === 'streaming';
  const canSend = draft.trim().length > 0;

  /**
   * Clear the chat history (••• menu). No confirm sheet — destructive actions
   * get undo, not dialogs (kebi-chat-clear-mockup): the toast carries an undo
   * that restores the exact snapshot for ~5s. A streaming turn is snapshotted as
   * stopped (its stream is aborted here), so undo never revives a dead spinner.
   *
   * kebi's server-side conversation memory (LangGraph checkpoint + recalled
   * intents — api-contract §DELETE /v1/user/data, scope=chat_history) is wiped
   * only once the undo window closes: the server delete is irreversible, so it
   * must not race a possible undo. Undo cancels it and screen/server agree.
   */
  function clearChat() {
    const snapshot: ChatTurn[] = turns.map((turn) =>
      turn.role === 'kebi' && turn.status === 'streaming'
        ? { ...turn, status: 'done', stopped: true, durationMs: Date.now() - turn.startedAt }
        : turn,
    );
    abortRef.current?.abort();
    clearTranscript();
    triggerHaptic('confirm-delete');
    const serverWipe = setTimeout(() => {
      deleteUserData(client, ['chat_history']).catch((err) => {
        // Screen is already cleared; a failed server wipe just means kebi still
        // remembers — log it, next clear retries. No user-facing error.
        console.warn('[chat] clear history server wipe failed', err);
      });
    }, TOAST_DISMISS_MS.withAction);
    showToast({
      text: t('chat.menu.cleared'),
      icon: 'trash',
      action: {
        label: t('chat.menu.undo'),
        onPress: () => {
          clearTimeout(serverWipe);
          restoreTranscript(snapshot);
        },
      },
    });
  }

  /** Cancel the in-flight stream: flag the turn stopped, then abort it. */
  function stop() {
    if (!abortRef.current) return;
    if (last?.role === 'kebi' && last.status === 'streaming') stopTurn(last.key);
    abortRef.current.abort();
    triggerHaptic('stop-stream');
    showToast({ text: t('chat.stopped'), icon: 'stop' });
  }

  async function submit(raw: string) {
    const text = raw.trim();
    // One turn streams at a time — ignore submit while a stream is in flight
    // (the button shows "stop" then, but a hardware return could still fire).
    if (!text || abortRef.current) return;
    setDraft('');

    const controller = new AbortController();
    abortRef.current = controller;

    const kebiKey = startTurn(text);
    const location = await getDeviceLocation();
    let finished = false;

    try {
      for await (const ev of streamChat(client, text, location, controller.signal)) {
        switch (ev.type) {
          case 'reasoning_step':
            upsertStep(kebiKey, ev.data);
            break;
          case 'message':
            setMessage(kebiKey, ev.data.content);
            break;
          case 'tool_result':
            addToolResult(kebiKey, ev.data);
            break;
          case 'done':
            finishTurn(kebiKey, ev.data.tool_calls_used);
            finished = true;
            break;
          case 'error':
            if (ev.data.detail === 'daily_limit_reached') {
              // Daily consult quota spent (ADR-112) — fail the turn and point to plans.
              failTurn(kebiKey, t('plans.limitReached.daily'));
              showUpgrade(t('plans.limitReached.daily'));
            } else {
              // The frame's `detail` is an internal log string — show a generic line.
              failTurn(kebiKey, t('chat.error'));
            }
            finished = true;
            break;
        }
      }
    } catch (err) {
      // Aborting (stop button / close) is benign — keep what streamed so far.
      if (!controller.signal.aborted) {
        // Log the real cause to Metro so a failing turn is diagnosable.
        console.warn('[chat] stream failed', err);
        failTurn(kebiKey, errorMessage(err, t));
        finished = true;
      }
    } finally {
      // Finish the turn unless it already errored — covers a clean end-without-done
      // frame AND a user "stop" (abort), so the turn never hangs in "streaming".
      if (!finished) finishTurn(kebiKey, 0);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <TopBar
        left={<IconButton icon="close" label={t('common.close')} onPress={onClose} />}
        // Chat title-pill: mascot avatar + brand wordmark, screen-centered
        // between the close button and a balancing spacer (kebi-chat-mockup).
        center={
          <View className="flex-row items-center gap-2 rounded-full bg-surface py-2 pe-3.5 ps-2">
            <View className="h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-small">
              <Mascot size={22} />
            </View>
            <Text className="font-semibold text-[14px] text-text">kebi</Text>
          </View>
        }
        // ••• overflow (kebi-chat-clear-mockup) — only once there's history to
        // act on; an empty chat keeps the balancing spacer.
        right={
          turns.length > 0 ? (
            <IconButton icon="ellipsis" label={t('common.more')} onPress={() => setMenuOpen(true)} />
          ) : (
            <View className="w-10" />
          )
        }
      />

      <Animated.View className="flex-1" style={bottomPad}>
        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(turn) => turn.key}
          renderItem={({ item }) => (
            <TurnRow turn={item} labels={turnLabels} onToggle={toggleCollapse} />
          )}
          contentContainerClassName="gap-6 px-6 pb-6 pt-2"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={64}
          onContentSizeChange={onContentSizeChange}
        />

        {/* Editor line — multiline so long text wraps and the field grows (up to
            ~5 lines, then scrolls). `submitBehavior="submit"` keeps return as the
            send key (and keeps the keyboard up) rather than inserting a newline. */}
        <View className="px-6 pb-2 pt-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => submit(draft)}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={softColor}
            returnKeyType="send"
            multiline
            submitBehavior="submit"
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('chat.placeholder')}
            className="max-h-[120px] p-0 text-[17px] leading-relaxed text-text"
          />
        </View>

        {/* Composer pill (bottom-right): mic (voice, placeholder) + send/stop. One
            outline toggle — paper-plane send when idle, a larger square stop while
            a turn streams (tapping stop aborts the response). Muted when empty. */}
        <View className="mx-4 mb-3 flex-row items-center gap-6 self-end rounded-full bg-surface px-5 py-3">
          <Pressable accessibilityRole="button" accessibilityLabel={t('chat.voice')} hitSlop={8}>
            <Icon name="mic" size={18} className="text-text" strokeWidth={1.6} />
          </Pressable>
          <Pressable
            onPress={isStreaming ? stop : () => submit(draft)}
            disabled={!isStreaming && !canSend}
            accessibilityRole="button"
            accessibilityLabel={isStreaming ? t('chat.stop') : t('chat.send')}
            accessibilityState={{ disabled: !isStreaming && !canSend }}
            hitSlop={8}
          >
            <Icon
              name={isStreaming ? 'stop' : 'send'}
              size={isStreaming ? 22 : 18}
              className={isStreaming || canSend ? 'text-text' : 'text-text-soft'}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* ••• bottom sheet — one destructive row; the row itself clears (no
          confirm), the cleared toast's undo is the safety net. */}
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={{
          avatar: <Mascot size={30} />,
          eyebrow: t('chat.menu.thisChat'),
          title: t('chat.kebi'),
        }}
        items={[
          {
            emoji: '🗑️',
            label: t('chat.menu.clear'),
            sub: t('chat.menu.clearSub'),
            destructive: true,
            onPress: clearChat,
          },
        ]}
        closeLabel={t('common.close')}
      />
    </View>
  );
}

interface TurnLabels {
  you: string;
  kebi: string;
  error: string;
  thinking: string;
  thought: string;
  stopped: string;
  interrupted: string;
}

function labels(t: (k: string) => string): TurnLabels {
  return {
    you: t('chat.you'),
    kebi: t('chat.kebi'),
    error: t('chat.error'),
    thinking: t('chat.thinking'),
    thought: t('chat.thought'),
    stopped: t('chat.stopped'),
    interrupted: t('chat.interrupted'),
  };
}

/**
 * Copy a turn's text to the clipboard (mockup `.turn-copy`). Always visible and
 * muted on mobile (no hover); a "copied" toast confirms (design-system §Toast).
 */
function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const { show } = useToast();
  const onPress = () => {
    void Clipboard.setStringAsync(text);
    show({ text: t('chat.copied'), icon: 'copy' });
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('chat.copy')}
      hitSlop={8}
      className="h-[22px] w-[22px] items-center justify-center rounded-full"
    >
      <Icon name="copy" size={12} className="text-text-soft" strokeWidth={2} />
    </Pressable>
  );
}

/**
 * One transcript turn. Memoized: the reducer preserves the identity of turns it
 * didn't touch, so only the streaming turn re-renders as frames upsert.
 */
const TurnRow = memo(function TurnRow({
  turn,
  labels: l,
  onToggle,
}: {
  turn: ChatTurn;
  labels: TurnLabels;
  onToggle: ChatTranscriptValue['toggleCollapse'];
}) {
  return turn.role === 'you' ? (
    <UserTurnRow turn={turn} label={l.you} />
  ) : (
    <KebiTurnRow turn={turn} labels={l} onToggle={onToggle} />
  );
});

function UserTurnRow({ turn, label }: { turn: UserTurn; label: string }) {
  return (
    <View className="items-end gap-1.5">
      <View className="flex-row-reverse items-center gap-2">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">{label}</Text>
        <Text className="text-[11px] text-text-soft">{formatTime(turn.at)}</Text>
        <CopyButton text={turn.text} />
      </View>
      <Text className="max-w-[85%] text-[17px] leading-relaxed text-text">{turn.text}</Text>
    </View>
  );
}

function KebiTurnRow({
  turn,
  labels: l,
  onToggle,
}: {
  turn: KebiTurn;
  labels: TurnLabels;
  onToggle: ChatTranscriptValue['toggleCollapse'];
}) {
  // Consult-vs-prose gate (ADR-050): the card surface keys on actual place
  // candidates, never on the mere presence of a tool result (a research turn
  // has one too — its answer is the prose).
  const hasCandidates = hasPlaceCandidates(turn.toolResults);
  const isConsultTurn = hasConsultResults(turn.toolResults);

  // Show the thinking panel once steps arrive, or while still streaming with no
  // answer yet (a simple greeting that runs no tools collapses to just text).
  const showReasoning =
    turn.steps.length > 0 ||
    (turn.status === 'streaming' && turn.message === '' && turn.toolResults.length === 0);

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">{l.kebi}</Text>
        <Text className="text-[11px] text-text-soft">{formatTime(turn.at)}</Text>
        {turn.message ? <CopyButton text={turn.message} /> : null}
      </View>

      {showReasoning ? (
        <ReasoningBlock
          steps={turn.steps}
          done={turn.status !== 'streaming'}
          durationMs={turn.durationMs}
          runningLabel={l.thinking}
          doneLabel={turn.stopped ? l.stopped : l.thought}
          interruptedLabel={l.interrupted}
          collapsed={turn.collapsed}
          onToggle={(next) => onToggle(turn.key, next)}
        />
      ) : null}

      {/* The agent's prose answer — suppressed only when the turn produced
          place candidates (then the card is the whole answer, ADR-050). On
          every other turn — plain chat, research, consult that found nothing —
          the prose carries the conversation. */}
      {turn.message && !hasCandidates ? (
        <Text className="text-[17px] leading-relaxed text-text-muted">
          {renderInlineMarkdown(turn.message)}
        </Text>
      ) : null}

      {/* The place card is a consult-only surface: skeleton while candidates
          stream in, then the card. A candidate-less consult turn with no prose
          still gets the card's empty-reason line (no_location is actionable). */}
      {turn.status === 'streaming' && hasCandidates ? <PlaceCardSkeleton /> : null}
      {turn.status === 'done' && (hasCandidates || (isConsultTurn && !turn.message)) ? (
        <ChatPlaceCard toolResults={turn.toolResults} />
      ) : null}

      {turn.status === 'error' ? (
        // The localized line set by the send handler (rate-limit vs generic).
        <Text className="text-[15px] text-danger">{turn.errorDetail ?? l.error}</Text>
      ) : null}
    </View>
  );
}

/**
 * Map a stream failure to a user-facing line. A 429 is the gateway's per-plan AI
 * rate limit (RateLimitGuard, ADR-016/022) — surface a "slow down" message;
 * everything else is a generic reach error. Duck-types `status` so the chat
 * screen needn't import the transport's HttpError (keeps the ./api seam clean).
 */
function errorMessage(err: unknown, t: (key: string) => string): string {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as { status?: number }).status
      : undefined;
  return status === 429 ? t('chat.rateLimited') : t('chat.error');
}

/**
 * Render kebi's light markdown in an assistant message: `**bold**` spans become
 * semibold (and a touch darker); everything else is plain. kebi only sends bold
 * emphasis in conversational replies, so this stays minimal — no full parser.
 */
function renderInlineMarkdown(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    return bold ? (
      <Text key={i} className="font-semibold text-text">
        {bold[1]}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    );
  });
}

/** "9:38 pm" from an epoch — delegates to the shared lowercase, Intl-free clock. */
function formatTime(at: number): string {
  return formatClockTime(new Date(at));
}
