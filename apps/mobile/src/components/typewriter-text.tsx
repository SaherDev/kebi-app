import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { GREETING_TYPE } from '../theme/motion';

/**
 * Types `text` out one character at a time with a blinking caret — the splash
 * wordmark's keystroke feel, made reusable for any typed copy (the home hero
 * greeting today).
 *
 * The splash wordmark is single-line with the caret in a sibling `Animated.View`;
 * this copy can WRAP, so the caret is a trailing glyph that flows inline with the
 * text. It blinks by toggling colour (never width), so the wrapped last line
 * never reflows. The reveal replays whenever `text` changes — the greeting
 * arrives async and can update. Under reduce-motion the full line shows at once
 * with no caret.
 *
 * Timings come from `GREETING_TYPE` (theme/motion.ts) — no inline literals.
 */

const CARET = '▏';

interface TypewriterTextProps {
  /** The full string to type out. */
  text: string;
  /** NativeWind classes for the text (the caret inherits its colour). */
  className?: string;
  /** Per-character cadence (ms). */
  perCharMs?: number;
  /** Caret on/off half-period (ms). */
  caretBlinkMs?: number;
  /** Keep the caret blinking after the line finishes typing (default: drop it). */
  showCaretWhenDone?: boolean;
}

export function TypewriterText({
  text,
  className,
  perCharMs = GREETING_TYPE.perCharMs,
  caretBlinkMs = GREETING_TYPE.caretBlinkMs,
  showCaretWhenDone = false,
}: TypewriterTextProps) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(reduced ? text.length : 0);
  const [blinkOn, setBlinkOn] = useState(true);

  // Reveal one character per `perCharMs`. Re-runs (and restarts from 0) when the
  // text changes; reduce-motion shows the whole line immediately.
  useEffect(() => {
    if (reduced) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= text.length; i++) {
      timers.push(setTimeout(() => setCount(i), i * perCharMs));
    }
    return () => timers.forEach(clearTimeout);
  }, [text, reduced, perCharMs]);

  const done = count >= text.length;
  const caretVisible = !reduced && (showCaretWhenDone || !done);

  // Blink while the caret is shown. Toggling on a fixed interval keeps it simple
  // and Hermes-safe; it stops once typing finishes (unless the caret persists).
  useEffect(() => {
    if (!caretVisible) {
      setBlinkOn(false);
      return;
    }
    setBlinkOn(true);
    const id = setInterval(() => setBlinkOn((on) => !on), caretBlinkMs);
    return () => clearInterval(id);
  }, [caretVisible, caretBlinkMs]);

  return (
    <Text className={className}>
      {text.slice(0, count)}
      {caretVisible ? (
        // Transparent (not removed) when blinked off, so its width never shifts
        // the trailing line. Colour otherwise inherits the parent text.
        <Text style={{ color: blinkOn ? undefined : 'transparent' }}>{CARET}</Text>
      ) : null}
    </Text>
  );
}
