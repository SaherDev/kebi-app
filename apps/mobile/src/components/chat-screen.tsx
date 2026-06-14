import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { ReasoningBlock } from './reasoning-block';
import { PlaceCardSkeleton } from './place-card-skeleton';
import {
  useChatTranscript,
  type ChatTranscriptValue,
  type ChatTurn,
  type KebiTurn,
  type UserTurn,
} from './chat-transcript-context';
import { useApiClient } from '../api/hooks';
import { streamChat } from '../api/chat';
import { getDeviceLocation } from '../lib/location';
import { useToast } from './toast-context';
import { useTranslation } from '../i18n/context';

interface ChatScreenProps {
  /** Close the chat — runs the collapse-back-into-the-button animation. */
  onClose: () => void;
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
export function ChatScreen({ onClose }: ChatScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;
  const client = useApiClient();
  const transcript = useChatTranscript();
  const { turns, startTurn, upsertStep, setMessage, addToolResult, finishTurn, failTurn, toggleCollapse } =
    transcript;

  const [draft, setDraft] = useState('');
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

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');

    // One turn streams at a time — abort any previous before starting.
    abortRef.current?.abort();
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
            failTurn(kebiKey, ev.data.detail);
            finished = true;
            break;
        }
      }
    } catch (err) {
      // Aborting (close/unmount) is benign — leave the partial turn as-is.
      if (!controller.signal.aborted) {
        // Log the real cause to Metro so a failing turn is diagnosable (the UI
        // shows a generic line). HttpError carries "API error: <status> …".
        console.warn('[chat] stream failed', err);
        failTurn(kebiKey, err instanceof Error ? err.message : t('chat.error'));
        finished = true;
      }
    } finally {
      // Stream ended without a done/error frame → finish on wall-clock.
      if (!finished && !controller.signal.aborted) finishTurn(kebiKey, 0);
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
        right={<View className="w-10" />}
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

        {/* Editor line — left-aligned (LTR) composer. */}
        <View className="px-6 pb-2 pt-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={softColor}
            returnKeyType="send"
            blurOnSubmit={false}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('chat.placeholder')}
            className="p-0 text-[17px] leading-relaxed text-text"
          />
        </View>

        {/* Photo + voice toolbar pill (placeholders this task; no AI button in chat).
            Left-aligned to match the LTR composer. Two icons, gap-24, no divider. */}
        <View className="mx-4 mb-3 flex-row items-center gap-6 self-start rounded-full bg-surface px-5 py-3">
          <Pressable accessibilityRole="button" accessibilityLabel={t('chat.photo')} hitSlop={8}>
            <Icon name="image" size={18} className="text-text" strokeWidth={1.6} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('chat.voice')} hitSlop={8}>
            <Icon name="mic" size={18} className="text-text" strokeWidth={1.6} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

interface TurnLabels {
  you: string;
  kebi: string;
  error: string;
  thinking: string;
  thought: string;
}

function labels(t: (k: string) => string): TurnLabels {
  return {
    you: t('chat.you'),
    kebi: t('chat.kebi'),
    error: t('chat.error'),
    thinking: t('chat.thinking'),
    thought: t('chat.thought'),
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
          doneLabel={l.thought}
          collapsed={turn.collapsed}
          onToggle={(next) => onToggle(turn.key, next)}
        />
      ) : null}

      {turn.message ? (
        <Text className="text-[17px] leading-relaxed text-text-muted">{turn.message}</Text>
      ) : null}

      {/* Placeholder while places are still streaming in. Task 2 swaps this for
          the real cards on done; until then a finished turn shows none (the
          message already names the picks), so the skeleton never lingers. */}
      {turn.status === 'streaming' && turn.toolResults.length > 0 ? <PlaceCardSkeleton /> : null}

      {turn.status === 'error' ? (
        // Generic, design-system-compliant line; the real cause is console.warn'd
        // in the send handler for diagnosis.
        <Text className="text-[15px] text-danger">{l.error}</Text>
      ) : null}
    </View>
  );
}

/** "9:38 pm" — manual format so it stays lowercase and Intl-independent (Hermes). */
function formatTime(at: number): string {
  const d = new Date(at);
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  const hour = d.getHours() % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
}
