import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ReasoningStepStatus } from '@kebi-app/shared';
import { Icon } from './icon';
import { DURATION, STAGGER_MS } from '../theme/motion';

/**
 * The reasoning block (kebi-chat-mockup.html `.reasoning`) — the thinking panel
 * above each agent answer in chat. Inline editor content, NOT a card: a header
 * (pulsing dot + label + meta + chevron) over a step list with a hairline rail.
 *
 * Driven entirely by the ADR-102 stream lifecycle the chat screen upserts by
 * `id`: a `done` step shows a filled check node + its narration; an `active`
 * step shows a ring + pulsing dot + shimmer skeleton (because its `summary` is
 * still `null`) — and an interrupted step left `active` simply stays a skeleton.
 * There are no pending rows and no "step N of M": the agent is dynamic, so the
 * contract carries no total (see api-contract.md). The run-level `done` flag
 * flips the header dot to success and is the cue to collapse on the next turn.
 *
 * Presentational only — the caller owns the stream, the per-step status, and
 * (optionally) the collapsed state. Light/dark is automatic via the tokens.
 */
export interface ReasoningBlockStep {
  /** Stable id (upsert key) — used as the React key. */
  id: string;
  status: ReasoningStepStatus;
  /** Short action — the bold line (contract `title`). Omit for a one-tier step. */
  title?: string;
  /** Result detail — the muted line (contract `summary`); `null` while active → skeleton. */
  summary: string | null;
}

export interface ReasoningBlockProps {
  steps: ReasoningBlockStep[];
  /** The run finished (SSE `done` frame). Dot → success; drives the meta tally. */
  done?: boolean;
  /** Turn duration in ms for the "· 1.8s" tally (summed `duration_ms` or wall-clock). */
  durationMs?: number;
  /** Status label beside the dot. Defaults to "thinking". */
  label?: string;
  /** Override the derived meta line verbatim (e.g. a translated string). */
  meta?: string;
  /** Controlled collapse. Omit for uncontrolled (see `defaultCollapsed`). */
  collapsed?: boolean;
  /** Initial collapse when uncontrolled. A finished block is typically collapsed. */
  defaultCollapsed?: boolean;
  /** Fired with the next collapsed value when the header is tapped. */
  onToggle?: (next: boolean) => void;
  /** Max lines per step narration before truncating. Defaults to {@link SUMMARY_LINES}. */
  summaryLines?: number;
}

const ENTER_EASE = Easing.out(Easing.ease);

/**
 * Reasoning summaries are process narration, not the answer — keep them terse.
 * Real streams can send long, raw model monologue (a paragraph, or a list of
 * place names); clamp the rendered detail so the trace stays scannable. The
 * full content lives in the answer + place cards, never the thinking panel.
 */
const SUMMARY_LINES = 2;

export function ReasoningBlock({
  steps,
  done = false,
  durationMs,
  label = 'thinking',
  meta,
  collapsed,
  defaultCollapsed = false,
  onToggle,
  summaryLines = SUMMARY_LINES,
}: ReasoningBlockProps) {
  const isControlled = collapsed !== undefined;
  const [internal, setInternal] = useState(defaultCollapsed);
  const isCollapsed = isControlled ? collapsed : internal;

  const toggle = () => {
    const next = !isCollapsed;
    if (!isControlled) setInternal(next);
    onToggle?.(next);
  };

  // Count steps present at first mount so the documented entrance stagger
  // (0/350/700/… ms) replays only for the initial batch; steps streamed in
  // later fade in immediately as they arrive, not after a growing delay.
  const initialCount = useRef(steps.length).current;

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const total = steps.length;
  const tally = durationMs != null ? ` · ${(durationMs / 1000).toFixed(1)}s` : '';
  const metaText =
    meta ??
    (done
      ? `${total} ${total === 1 ? 'step' : 'steps'}${tally}`
      : `step ${Math.max(doneCount, 1)} · streaming…`);

  return (
    <View className="mb-3 gap-2">
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: !isCollapsed }}
        accessibilityLabel={`${label}, ${metaText}`}
        className="flex-row items-center justify-between gap-2.5"
      >
        <View className="min-w-0 flex-row items-center gap-2.5">
          <View className="flex-row items-center gap-2">
            <LiveDot done={done} />
            <Text className="text-[12px] font-medium lowercase text-text-muted">{label}</Text>
          </View>
          <Text numberOfLines={1} className="shrink text-[12px] text-text-soft">
            {metaText}
          </Text>
        </View>
        <Chevron expanded={!isCollapsed} />
      </Pressable>

      <Collapsible collapsed={isCollapsed}>
        {total > 0 ? (
          <View className="relative ms-[7px] gap-3.5">
            {/* Hairline rail behind the nodes (inset 8px top/bottom). */}
            <View className="absolute bottom-2 left-0 top-2 w-px bg-surface-2" />
            {steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                enterDelay={i < initialCount ? i * STAGGER_MS : 0}
                summaryLines={summaryLines}
              />
            ))}
          </View>
        ) : null}
      </Collapsible>
    </View>
  );
}

/** 6px header dot: pulses while running (text tone), solid success when done. */
function LiveDot({ done }: { done: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (done) {
      cancelAnimation(s);
      s.value = 1;
      return;
    }
    // scale 1→1.4 / opacity 1→0.5 over 1.4s ease-in-out, looping (mockup live-pulse).
    s.value = withRepeat(withTiming(1.4, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(s);
  }, [done, s]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: 1 - (s.value - 1) * 1.25, // 1 at scale 1 → 0.5 at scale 1.4
  }));
  return (
    <Animated.View
      style={style}
      className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-success' : 'bg-text'}`}
    />
  );
}

/** Toggle chevron: points down when expanded, right when collapsed. */
function Chevron({ expanded }: { expanded: boolean }) {
  const r = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    r.value = withTiming(expanded ? 1 : 0, { duration: DURATION.stateChangeFast, easing: ENTER_EASE });
  }, [expanded, r]);
  // chevron-right is authored pointing right (0°); rotate 90° → points down.
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 90}deg` }] }));
  return (
    <Animated.View style={style} className="h-5 w-5 items-center justify-center">
      <Icon name="chevron-right" size={12} className="text-text-soft" strokeWidth={2} />
    </Animated.View>
  );
}

/** One step: node on the rail + narration, or a shimmer skeleton while active. */
function StepRow({
  step,
  enterDelay,
  summaryLines,
}: {
  step: ReasoningBlockStep;
  enterDelay: number;
  summaryLines: number;
}) {
  const enter = useSharedValue(0);
  useEffect(() => {
    // Fade + slide-down entrance (mockup step-in): translateY -3 → 0.
    enter.value = withDelay(enterDelay, withTiming(1, { duration: DURATION.entrance, easing: ENTER_EASE }));
  }, [enter, enterDelay]);
  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * -3 }],
  }));

  return (
    <Animated.View style={style} className="relative flex-row items-start gap-3 ps-[18px]">
      {/* Node disc: a bg-coloured circle masks the rail, holding the status node. */}
      <View className="absolute -left-2.5 -top-[3px] h-5 w-5 items-center justify-center rounded-full bg-bg">
        <StatusNode status={step.status} />
      </View>
      <View className="min-w-0 flex-1 gap-[3px]">
        {/* Bold action line (the step title), when present. */}
        {step.title ? (
          <Text numberOfLines={1} className="text-[13px] font-medium text-text">
            {step.title}
          </Text>
        ) : null}
        {step.summary ? (
          // Result detail — muted under a title, primary when there's no title.
          <Text
            numberOfLines={summaryLines}
            className={step.title ? 'text-[12px] text-text-muted' : 'text-[13px] text-text'}
            style={{ lineHeight: step.title ? 18 : 19 }}
          >
            {step.summary}
          </Text>
        ) : step.status === 'active' ? (
          // Active & still streaming → shimmer bars in place of the detail.
          <>
            <Shimmer width="80%" />
            <Shimmer width="40%" />
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** 14px node: filled check when done, ringed pulsing dot while active. */
function StatusNode({ status }: { status: ReasoningStepStatus }) {
  if (status === 'done') {
    return (
      <View className="h-3.5 w-3.5 items-center justify-center rounded-full bg-text">
        <Icon name="check" size={8} className="text-bg" strokeWidth={3} />
      </View>
    );
  }
  return (
    <View className="h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-text bg-bg">
      <ActivePulse />
    </View>
  );
}

/** 5px inner dot pulsing inside an active node (mockup step-pulse). */
function ActivePulse() {
  const p = useSharedValue(0);
  useEffect(() => {
    // scale 1→0.6 / opacity 1→0.4 over 1.2s ease-in-out, looping.
    p.value = withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(p);
  }, [p]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - p.value * 0.4 }],
    opacity: 1 - p.value * 0.6,
  }));
  return <Animated.View style={style} className="h-[5px] w-[5px] rounded-full bg-text" />;
}

/** Skeleton bar with a linear shimmer (the only linear-paced motion, 1.4s). */
function Shimmer({ width }: { width: `${number}%` }) {
  const sh = useSharedValue(0);
  useEffect(() => {
    sh.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, true);
    return () => cancelAnimation(sh);
  }, [sh]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 + sh.value * 0.5 }));
  return <Animated.View style={[{ width }, style]} className="h-[9px] rounded-[3px] bg-surface-2" />;
}

/**
 * Animated height/opacity collapse. The content is always laid out at its
 * natural height (never clamped to 0 before it's measured — that traps
 * `onLayout` at 0 under Fabric), so the measured height is captured reliably
 * and tracked as steps stream in. `progress` animates 0↔1 over 240ms; the
 * measured height rides a shared value so the worklet stays reactive.
 */
function Collapsible({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  const progress = useSharedValue(collapsed ? 0 : 1);
  const measuredH = useSharedValue(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) measuredH.value = h;
  };

  useEffect(() => {
    progress.value = withTiming(collapsed ? 0 : 1, { duration: DURATION.symmetric, easing: ENTER_EASE });
  }, [collapsed, progress]);

  const style = useAnimatedStyle(() => {
    // Until measured, don't constrain height — let the content define it.
    if (measuredH.value === 0) return { opacity: progress.value };
    return { height: measuredH.value * progress.value, opacity: progress.value };
  });

  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]}>
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}
