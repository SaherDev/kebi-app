import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from 'nativewind';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Mascot } from './mascot';
import { SPLASH, SPRING_CONFIG } from '../theme/motion';
import { SPLASH_HALO } from '../theme/palette';
import { useTranslation } from '../i18n/context';

/**
 * App-boot splash — the animated mascot + wordmark + tagline shown once on cold
 * launch, then faded out to reveal home (design-system.md → Loading states #1).
 * A faithful port of kebi-splash-mockup.html / kebi-splash-dark-mockup.html: the
 * mascot springs in and floats over a soft radial halo, the wordmark types out
 * with a blinking cursor, the tagline rises in, and three dots pulse as a
 * "booting" cue — then the whole thing fades + scales up and calls `onDone`.
 *
 * Boot is a passive/navigation moment, so there is NO haptic here (ADR-043).
 * The full timeline lives in `SPLASH` (theme/motion.ts) — no inline timing
 * literals. Under reduce-motion the timeline is skipped: the rested state shows
 * briefly, then routes.
 */

interface SplashProps {
  /** Called once the fade-out completes — the host unmounts the overlay. */
  onDone: () => void;
}

const EASE_OUT = Easing.out(Easing.ease);
const EASE_INOUT = Easing.inOut(Easing.ease);

export function Splash({ onDone }: SplashProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const reduced = useReducedMotion();

  const word = t('brand.wordmark');

  // onDone via ref so the mount-once timeline never restarts if the parent
  // re-renders with a fresh callback identity mid-splash.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // How many characters of the wordmark are currently typed — driven up one at a
  // time so it reads as real keystrokes (the mockup's `steps()` reveal).
  const [typedCount, setTypedCount] = useState(0);

  const enter = useSharedValue(0); // mascot entrance 0→1
  const float = useSharedValue(0); // mascot float loop 0→1 (reverses)
  const halo = useSharedValue(0); // halo fade 0→1
  const cursorBlink = useSharedValue(0); // cursor blink 0→1 (reverses)
  const cursorOn = useSharedValue(1); // cursor visible until typing ends
  const tagline = useSharedValue(0); // tagline fade+rise 0→1
  const dotsFade = useSharedValue(0); // dots container fade 0→1
  const dotA = useSharedValue(0);
  const dotB = useSharedValue(0);
  const dotC = useSharedValue(0);
  const out = useSharedValue(0); // splash fade-out 0→1

  // The whole timeline is a setup/cleanup pair: setup schedules every step,
  // cleanup clears them. Idempotent on purpose — if the effect re-runs (e.g.
  // React's dev double-invoke), it cleanly restarts rather than stranding a
  // half-cancelled timeline. `onDoneRef` keeps the callback fresh without
  // re-running the effect.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // The fade-out is the visual; `onDone` fires off a matching JS timer rather
    // than the worklet completion callback, so handoff is deterministic (and
    // unit-testable under fake timers) even if a frame is dropped.
    const beginOut = () => {
      out.value = withTiming(1, { duration: SPLASH.out.duration, easing: EASE_OUT });
      timers.push(setTimeout(() => onDoneRef.current(), SPLASH.out.duration));
    };

    if (reduced) {
      // Skip the choreography — settle every element at rest, hide the cursor.
      enter.value = 1;
      halo.value = 1;
      cursorOn.value = 0;
      tagline.value = 1;
      dotsFade.value = 1;
      setTypedCount(word.length);
      timers.push(setTimeout(beginOut, SPLASH.reducedHoldMs));
      return () => timers.forEach(clearTimeout);
    }

    enter.value = withDelay(SPLASH.mascot.delay, withSpring(1, SPRING_CONFIG.entrance));
    halo.value = withDelay(SPLASH.halo.delay, withTiming(1, { duration: SPLASH.halo.duration, easing: EASE_OUT }));
    float.value = withDelay(
      SPLASH.float.delay,
      withRepeat(withTiming(1, { duration: SPLASH.float.halfDuration, easing: EASE_INOUT }), -1, true),
    );

    // Type one character per step across `duration`, so the word lands key by key.
    const stepMs = SPLASH.wordmark.duration / word.length;
    for (let i = 1; i <= word.length; i++) {
      timers.push(setTimeout(() => setTypedCount(i), SPLASH.wordmark.delay + i * stepMs));
    }
    cursorBlink.value = withRepeat(
      withTiming(1, { duration: SPLASH.wordmark.cursorBlinkHalf, easing: EASE_INOUT }),
      -1,
      true,
    );
    // Snap the cursor off the instant typing finishes.
    cursorOn.value = withDelay(SPLASH.wordmark.delay + SPLASH.wordmark.duration, withTiming(0, { duration: 0 }));

    tagline.value = withDelay(SPLASH.tagline.delay, withTiming(1, { duration: SPLASH.tagline.duration, easing: EASE_OUT }));

    dotsFade.value = withDelay(SPLASH.dots.delay, withTiming(1, { duration: SPLASH.dots.fadeDuration, easing: EASE_OUT }));
    const pulse = (offset: number) =>
      withDelay(
        SPLASH.dots.delay + offset,
        withRepeat(withTiming(1, { duration: SPLASH.dots.pulseHalf, easing: EASE_INOUT }), -1, true),
      );
    dotA.value = pulse(0);
    dotB.value = pulse(SPLASH.dots.stagger);
    dotC.value = pulse(SPLASH.dots.stagger * 2);

    timers.push(setTimeout(beginOut, SPLASH.holdMs));
    return () => timers.forEach(clearTimeout);
    // Run once on mount: the boot timeline plays a single time. Everything it
    // closes over is stable for the splash's lifetime (shared values are refs,
    // `reduced`/`word` don't change mid-boot, `onDone` is read via ref), so an
    // empty dep list is correct — and avoids re-scheduling on each typed char.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: 1 - out.value,
    transform: [{ scale: 1 + out.value * (SPLASH.out.scale - 1) }],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      {
        translateY:
          (1 - enter.value) * SPLASH.mascot.fromTranslateY + float.value * SPLASH.float.translateY,
      },
      { scale: SPLASH.mascot.fromScale + enter.value * (1 - SPLASH.mascot.fromScale) },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));

  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOn.value * cursorBlink.value }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * SPLASH.tagline.fromTranslateY }],
  }));

  const dotsFadeStyle = useAnimatedStyle(() => ({ opacity: dotsFade.value }));
  const dotAStyle = useDotStyle(dotA);
  const dotBStyle = useDotStyle(dotB);
  const dotCStyle = useDotStyle(dotC);

  const haloInner = SPLASH_HALO.innerOpacity[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, containerStyle]}
      className="items-center justify-center bg-bg"
    >
      {/* Mascot stage — halo glows behind, mascot springs in + floats. */}
      <View
        style={{ width: SPLASH.mascotSize, height: SPLASH.mascotSize }}
        className="items-center justify-center"
      >
        <Animated.View
          pointerEvents="none"
          style={[
            haloStyle,
            { position: 'absolute', width: SPLASH.haloSize, height: SPLASH.haloSize },
          ]}
        >
          <Svg width={SPLASH.haloSize} height={SPLASH.haloSize}>
            <Defs>
              <RadialGradient id="splashHalo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={SPLASH_HALO.color} stopOpacity={haloInner} />
                <Stop offset="65%" stopColor={SPLASH_HALO.color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={SPLASH.haloSize / 2} cy={SPLASH.haloSize / 2} r={SPLASH.haloSize / 2} fill="url(#splashHalo)" />
          </Svg>
        </Animated.View>
        <Animated.View style={mascotStyle}>
          <Mascot size={SPLASH.mascotSize} />
        </Animated.View>
      </View>

      {/* Wordmark — typed one character at a time, blinking cursor at the end
          (the mockup's `steps()` keystroke reveal). */}
      <View className="mt-[22px] flex-row items-center">
        <Text numberOfLines={1} className="text-title font-extrabold text-text">
          {word.slice(0, typedCount)}
        </Text>
        <Animated.View
          style={[cursorStyle, { width: 2, height: SPLASH.wordmark.cursorHeight, marginStart: 1 }]}
          className="bg-text"
        />
      </View>

      {/* Tagline — fades up late, lowercase voice. */}
      <Animated.View style={taglineStyle} className="mt-[22px]">
        <Text className="text-[14px] text-text-muted">{t('brand.tagline')}</Text>
      </Animated.View>

      {/* Loading dots — subtle "booting" cue near the bottom. */}
      <Animated.View style={dotsFadeStyle} className="absolute bottom-[80px] flex-row gap-1.5">
        <Animated.View style={dotAStyle} className="size-[5px] rounded-full bg-text-soft" />
        <Animated.View style={dotBStyle} className="size-[5px] rounded-full bg-text-soft" />
        <Animated.View style={dotCStyle} className="size-[5px] rounded-full bg-text-soft" />
      </Animated.View>
    </Animated.View>
  );
}

/** A single dot's pulse: opacity 0.3→1 + a 2px lift, driven by its shared value. */
function useDotStyle(v: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: 0.3 + v.value * 0.7,
    transform: [{ translateY: v.value * -2 }],
  }));
}
