import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useRouter } from 'expo-router';
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
import { ChatAnswer } from './chat-answer';
import { TurnProcess } from './turn-process';
import { ChatEntityRail } from './chat-entity-rail';
import { useOpenChatEntity, PLACE_ORIGIN_CHAT } from './use-open-chat-entity';
import type { ChatEntity } from '@kebi-app/shared';
import {
  useChatTranscript,
  type ChatTranscriptValue,
  type ChatTurn,
  type KebiTurn,
  type TurnErrorKind,
  type UserTurn,
} from './chat-transcript-context';
import { useApiClient } from '../api/hooks';
import { streamChat } from '../api/chat';
import { deleteUserData } from '../api/user-data';
import { PRESS, TOAST_DISMISS_MS } from '../theme/motion';
import { getDeviceLocation } from '../lib/location';
import { shouldFollow } from '../lib/stream-follow';
import { formatClockTime } from '../lib/format-relative-time';
import { triggerHaptic } from '../lib/haptics';
import { useToast } from './toast-context';
import { useUpgradeToast } from './use-upgrade-toast';
import { useTranslation } from '../i18n/context';

/** Scroll sampling while a turn streams — tight enough to track the tail. */
const SCROLL_THROTTLE_MS = 16;

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
 * render the real card). Bottom is the composer card — field + mic + send⇄stop
 * orb in one surface container (kebi-chat-input-options a, no AI button).
 */
export function ChatScreen({ onClose, seed }: ChatScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;
  const client = useApiClient();
  const { show: showToast, reserveTopAnchor } = useToast();
  const showUpgrade = useUpgradeToast();
  const transcript = useChatTranscript();
  // Stable across renders — TurnRow is memoized, so a fresh handler per render
  // would re-render every turn in the list. Takes `onClose` because chat is an
  // overlay: the card has to be pushed with the chat down, not under it.
  const openEntity = useOpenChatEntity(onClose);
  const { turns, startTurn, upsertStep, appendStepText, appendMessage, setMessage, finishTurn, stopTurn, failTurn, toggleCollapse, clearTranscript, restoreTranscript } =
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
  // Whether the user's finger is what is moving the list (see `onScroll`).
  const draggingRef = useRef(false);

  // Abort an in-flight stream when the chat closes (the overlay unmounts us).
  // The transcript persists above, so a partial turn stays visible on reopen.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Route toasts to the top while chat is open — the bottom spot is covered by
  // the composer and (often) the keyboard, so a bottom toast would be hidden.
  useEffect(() => reserveTopAnchor(), [reserveTopAnchor]);

  /** Resend the question a failed or stopped turn was answering. */
  const askAgainFor = useCallback(
    (previous: ChatTurn | undefined) =>
      previous?.role === 'you' ? () => void submit(previous.text) : undefined,
    // `submit` is declared below and stable for the life of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Chat is an overlay, not a route, so closing it and pushing plans would put
  // the conversation off screen — backing out of plans would land on home. The
  // same `from=chat` marker the place and area screens use brings it back.
  const openPlans = useCallback(() => {
    onClose();
    router.push({ pathname: '/plans', params: { from: PLACE_ORIGIN_CHAT } });
  }, [onClose, router]);

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
    atBottomRef.current = shouldFollow({
      fromBottom: contentSize.height - (layoutMeasurement.height + contentOffset.y),
      dragging: draggingRef.current,
      following: atBottomRef.current,
    });
  };
  const onContentSizeChange = () => {
    // Not animated while a turn streams: a 300ms scroll animation restarting on
    // every token never arrives, so the tail stays just off screen.
    if (atBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: !reducedMotion && !isStreaming });
    }
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

  /**
   * Send the draft from the composer (orb tap or keyboard return). Guarded the
   * same way the button disables, so a hardware return on an empty draft (or
   * mid-stream) is a no-op. Haptic fires only here — a seed auto-send is not
   * something the user did, so `submit` itself stays silent.
   */
  function sendDraft() {
    if (!canSend || abortRef.current) return;
    triggerHaptic('send-message');
    void submit(draft);
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

    // Sending is an explicit "show me the new turn": resume following even if
    // they had scrolled up to read an earlier answer, or the turn they just
    // sent lands below the fold and the reply streams in off screen.
    atBottomRef.current = true;
    const kebiKey = startTurn(text);
    listRef.current?.scrollToEnd({ animated: !reducedMotion });
    const location = await getDeviceLocation();
    let finished = false;

    try {
      for await (const ev of streamChat(client, text, location, controller.signal)) {
        switch (ev.type) {
          case 'reasoning_step':
            upsertStep(kebiKey, ev.data);
            break;
          case 'reasoning_delta':
            // The agent thinking out loud into a row already on screen.
            appendStepText(kebiKey, ev.data);
            break;
          case 'message_delta':
            // The answer typing into the bubble (plain prose, never links).
            appendMessage(kebiKey, ev.data);
            break;
          case 'message':
            // Authoritative: replaces everything `message_delta` streamed, and
            // is the only frame that carries links + entities.
            setMessage(kebiKey, ev.data.content, ev.data.entities);
            break;
          case 'done':
            finishTurn(kebiKey, ev.data.tool_calls_used);
            finished = true;
            break;
          case 'error':
            if (ev.data.detail === 'daily_limit_reached') {
              // Daily consult quota spent (ADR-112) — fail the turn and point to plans.
              failTurn(kebiKey, t('plans.limitReached.daily'), 'rate_limit');
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
        const failure = errorMessage(err, t);
        failTurn(kebiKey, failure.detail, failure.kind);
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
        // ? + ••• (kebi-help-mockup / kebi-chat-clear-mockup) — both always
        // visible, chat history or not. Chat is an overlay above the router,
        // so the ? closes it first — the transcript lives above the overlay
        // and survives for /help.
        right={
          <View className="flex-row items-center gap-2">
            <IconButton
              icon="help"
              label={t('chat.help')}
              onPress={() => {
                onClose();
                router.push('/help');
              }}
            />
            <IconButton
              icon="ellipsis"
              label={t('common.more')}
              onPress={() => setMenuOpen(true)}
            />
          </View>
        }
      />

      <Animated.View className="flex-1" style={bottomPad}>
        <FlatList
          ref={listRef}
          data={turns}
          keyExtractor={(turn) => turn.key}
          renderItem={({ item, index }) => (
            <TurnRow
              turn={item}
              labels={turnLabels}
              onToggle={toggleCollapse}
              onOpenEntity={openEntity}
              // The question that produced this turn is the row right above it,
              // so a failed turn can offer to send it again rather than asking
              // the user to retype what they can still see (ADR-056).
              onAskAgain={askAgainFor(turns[index - 1])}
              onSeePlans={openPlans}
            />
          )}
          // Bottom-aligned while empty so the opener sits where the
          // conversation will be and gets pushed up by the first answer.
          contentContainerClassName={`gap-6 px-6 pb-6 pt-2 ${turns.length === 0 ? 'grow justify-end' : ''}`}
          ListEmptyComponent={<ChatOpener onSelect={(text) => void submit(text)} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          onScrollBeginDrag={() => (draggingRef.current = true)}
          onScrollEndDrag={() => (draggingRef.current = false)}
          onMomentumScrollEnd={() => (draggingRef.current = false)}
          scrollEventThrottle={SCROLL_THROTTLE_MS}
          onContentSizeChange={onContentSizeChange}
        />

        {/* Composer card (kebi-chat-input-options, option a): ONE surface card
            holds the field and the actions, so "where do i type" has a visible
            answer — the bare line + detached pill read as more transcript. The
            input is multiline so long text wraps and the card grows (up to ~5
            lines, then scrolls); `submitBehavior="submit"` keeps return as the
            send key (and keeps the keyboard up) rather than inserting a newline. */}
        <View className="mx-4 mb-3 rounded-[20px] bg-surface pb-2 pe-2 ps-4 pt-3.5">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={sendDraft}
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

          {/* Actions row: mic (voice, placeholder) + the send⇄stop orb
              (kebi-chat-polish-options 3a/2a). The orb "arms" as you type —
              soft bare plane when the draft is empty, a solid ink disc once
              there's text — and becomes the stop square while a turn streams
              (tapping stop aborts the response). PRESS gives the tactile
              scale/opacity dip on the armed orb. */}
          <View className="mt-2 flex-row items-center justify-end gap-4">
            <Pressable accessibilityRole="button" accessibilityLabel={t('chat.voice')} hitSlop={8}>
              <Icon name="mic" size={18} className="text-text" strokeWidth={1.6} />
            </Pressable>
            <Pressable
              onPress={isStreaming ? stop : sendDraft}
              disabled={!isStreaming && !canSend}
              accessibilityRole="button"
              accessibilityLabel={isStreaming ? t('chat.stop') : t('chat.send')}
              accessibilityState={{ disabled: !isStreaming && !canSend }}
              hitSlop={8}
              // PRESS stays in every state — NativeWind's transition classes
              // must not mount/unmount between renders; only the fill toggles.
              className={`h-9 w-9 items-center justify-center rounded-full ${
                isStreaming || canSend ? 'bg-text' : ''
              } ${PRESS}`}
            >
              {isStreaming ? (
                <View className="h-3 w-3 rounded-[3px] bg-bg" />
              ) : (
                <Icon
                  name="send"
                  size={canSend ? 16 : 18}
                  className={canSend ? 'text-bg' : 'text-text-soft'}
                  strokeWidth={1.8}
                />
              )}
            </Pressable>
          </View>
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
  /** Eyebrow over the entity rail — everywhere this turn named, area or venue. */
  mentioned: string;
  /** Resends the question already on screen after a failure or a stop. */
  askAgain: string;
  /** Opens the plans screen when a turn hit the daily limit. */
  seePlans: string;
  notNow: string;
  limitDetail: string;
  offlineDetail: string;
  errorDetail: string;
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
    mentioned: t('chat.mentioned'),
    askAgain: t('chat.askAgain'),
    seePlans: t('plans.upgradeAction'),
    notNow: t('chat.notNow'),
    limitDetail: t('chat.limitDetail'),
    offlineDetail: t('chat.offlineDetail'),
    errorDetail: t('chat.errorDetail'),
  };
}

/**
 * Prose segments carry no entities — links only ever arrive on the final
 * `message` frame. A shared constant keeps ChatAnswer's memo from re-running on
 * a fresh `[]` every render.
 */
const EMPTY_ENTITIES: ChatEntity[] = [];

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
  onOpenEntity,
  onAskAgain,
  onSeePlans,
}: {
  turn: ChatTurn;
  labels: TurnLabels;
  onToggle: ChatTranscriptValue['toggleCollapse'];
  onOpenEntity: (entity: ChatEntity) => void;
  /** Resend this turn's question — undefined when we can't recover its text. */
  onAskAgain?: () => void;
  onSeePlans: () => void;
}) {
  return turn.role === 'you' ? (
    <UserTurnRow turn={turn} label={l.you} />
  ) : (
    <KebiTurnRow
      turn={turn}
      labels={l}
      onToggle={onToggle}
      onOpenEntity={onOpenEntity}
      onAskAgain={onAskAgain}
      onSeePlans={onSeePlans}
    />
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
  onOpenEntity,
  onAskAgain,
  onSeePlans,
}: {
  turn: KebiTurn;
  labels: TurnLabels;
  onAskAgain?: () => void;
  onSeePlans: () => void;
  onToggle: ChatTranscriptValue['toggleCollapse'];
  onOpenEntity: (entity: ChatEntity) => void;
}) {
  const settled = turn.status !== 'streaming';
  // Stable so <TurnProcess> stays memoized: this row re-renders on every answer
  // token, and a fresh lambda here would re-render the work chips with it —
  // restarting their pulse/shimmer/collapse animations 30+ times a second.
  const toggleThis = useCallback(
    (next: boolean) => onToggle(turn.key, next),
    [onToggle, turn.key],
  );
  // An empty chip is a turn still waiting on its first frame — show one so the
  // turn isn't a blank row while kebi thinks.
  const showPlaceholderChip =
    turn.segments.length === 0 && turn.message === '' && turn.status === 'streaming';

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center gap-2">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">{l.kebi}</Text>
        <Text className="text-[11px] text-text-soft">{formatTime(turn.at)}</Text>
        {turn.message ? <CopyButton text={turn.message} /> : null}
      </View>

      {/* The process: what the agent SAID as commentary prose, what it DID as
          chips between the sentences, live while it streams — then folded into
          one "thought for 12s" header once it settles (ADR-055). */}
      <TurnProcess
        segments={turn.segments}
        settled={settled}
        stopped={turn.stopped}
        durationMs={turn.stepDurationMs ?? turn.durationMs}
        collapsed={turn.collapsed}
        onToggle={toggleThis}
        labels={l}
        onOpenEntity={onOpenEntity}
      />

      {showPlaceholderChip ? (
        <ReasoningBlock steps={[]} runningLabel={l.thinking} collapsed />
      ) : null}

      {/* The prose IS the answer on every turn (ADR-136): kebi no longer sends
          place payloads to chat, it names the places in the text and links
          them. The rail below indexes those links one destination at a time. */}
      {turn.message ? (
        <ChatAnswer message={turn.message} entities={turn.entities} onOpen={onOpenEntity} />
      ) : null}

      {turn.status === 'done' ? (
        <ChatEntityRail entities={turn.entities} label={l.mentioned} onOpen={onOpenEntity} />
      ) : null}

      {turn.status === 'error' ? (
        <TurnFailure
          kind={turn.errorKind ?? 'generic'}
          detail={turn.errorDetail ?? l.error}
          labels={l}
          onAskAgain={onAskAgain}
          onSeePlans={onSeePlans}
        />
      ) : null}

      {/* A turn you stopped keeps what it said — you asked it to stop, not to
          disappear — and gets the same way back in as a failure. */}
      {turn.stopped && onAskAgain ? (
        <Pressable
          onPress={onAskAgain}
          accessibilityRole="button"
          accessibilityLabel={l.askAgain}
          className={`mt-1 self-start rounded-medium border border-surface-2 px-3 py-2 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{l.askAgain}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The chat with nothing in it (ADR-056). The mascot button is the app's most
 * inviting affordance and used to open onto a bare composer, which made the
 * first tap feel like a mistake.
 *
 * Kebi asks first, then three prompts. Deliberately **not** the home chips:
 * these show what chat can do that a chip can't — several people, memory of
 * where you've been, right now — so they earn their place next to home's row.
 */
function ChatOpener({ onSelect }: { onSelect: (text: string) => void }) {
  const { t } = useTranslation();
  const prompts = [t('chat.opener.first'), t('chat.opener.second'), t('chat.opener.third')];

  return (
    <View className="gap-6">
      <View className="gap-1.5">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('chat.kebi')}
        </Text>
        <Text className="text-[17px] leading-relaxed text-text">{t('chat.greeting')}</Text>
      </View>
      <View className="gap-3">
        {prompts.map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => onSelect(prompt)}
            accessibilityRole="button"
            accessibilityLabel={prompt}
            className={`self-start ${PRESS}`}
          >
            <Text className="text-[15px] text-text-muted">{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * A turn that ended without an answer (ADR-056). Unique to chat: the failed
 * input is still on screen one line above, so the recovery is "ask again"
 * rather than a description of what broke.
 *
 * `--danger` is the dot, never the sentence — a failed turn reads as a remark
 * in the transcript, not an alarm. A rate limit is warn-toned and offers the
 * plans screen instead of a retry that is guaranteed to fail.
 */
function TurnFailure({
  kind,
  detail,
  labels: l,
  onAskAgain,
  onSeePlans,
}: {
  kind: TurnErrorKind;
  detail: string;
  labels: TurnLabels;
  onAskAgain?: () => void;
  onSeePlans: () => void;
}) {
  const limited = kind === 'rate_limit';
  const sub = limited ? l.limitDetail : kind === 'offline' ? l.offlineDetail : l.errorDetail;

  return (
    <View className="flex-row items-start gap-2.5">
      <View
        className={`mt-2 size-1.5 rounded-full ${limited || kind === 'offline' ? 'bg-warn' : 'bg-danger'}`}
      />
      <View className="flex-1">
        <Text className="text-body leading-6 text-text">{detail}</Text>
        <Text className="mt-0.5 text-small text-text-muted">{sub}</Text>
        <View className="mt-2 flex-row gap-2">
          {limited ? (
            <>
              <Pressable
                onPress={onSeePlans}
                accessibilityRole="button"
                accessibilityLabel={l.seePlans}
                className={`rounded-medium border border-surface-2 px-3 py-2 ${PRESS}`}
              >
                <Text className="text-small font-semibold text-text">{l.seePlans}</Text>
              </Pressable>
              <View className="justify-center px-1">
                <Text className="text-small text-text-soft">{l.notNow}</Text>
              </View>
            </>
          ) : onAskAgain ? (
            <Pressable
              onPress={onAskAgain}
              accessibilityRole="button"
              accessibilityLabel={l.askAgain}
              className={`rounded-medium border border-surface-2 px-3 py-2 ${PRESS}`}
            >
              <Text className="text-small font-semibold text-text">{l.askAgain}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Map a stream failure to a user-facing line **and its kind** (ADR-056). A 429 is
 * the gateway's per-plan AI rate limit (RateLimitGuard, ADR-016/022) — nothing
 * broke, so it is warn-toned and retry-less; a transport failure with no status
 * never reached the network at all, which reads as offline. Duck-types `status`
 * so the chat screen needn't import the transport's HttpError (keeps the ./api
 * seam clean).
 */
function errorMessage(
  err: unknown,
  t: (key: string) => string,
): { detail: string; kind: TurnErrorKind } {
  const status =
    err && typeof err === 'object' && 'status' in err
      ? (err as { status?: number }).status
      : undefined;
  if (status === 429) return { detail: t('chat.rateLimited'), kind: 'rate_limit' };
  if (status === undefined) return { detail: t('chat.offline'), kind: 'offline' };
  return { detail: t('chat.error'), kind: 'generic' };
}

/** "9:38 pm" from an epoch — delegates to the shared lowercase, Intl-free clock. */
function formatTime(at: number): string {
  return formatClockTime(new Date(at));
}
