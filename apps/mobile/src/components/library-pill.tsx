import { View, Text } from 'react-native';
import type { PillTone } from '@kebi-app/shared';

/**
 * A Library status pill (kebi-library-mockup.html `.pill`): a tinted capsule
 * with a leading tone dot — or, on the like/dislike axis, a leading 👍/👎
 * glyph instead of the dot. Tones map to the existing pill theme tokens, so
 * light/dark is automatic. The label is passed already-translated; glyph-only
 * pills omit it and carry an `accessibilityLabel` for screen readers.
 */

interface ToneClasses {
  bg: string;
  text: string;
  dot: string;
}

const TONE: Record<PillTone, ToneClasses> = {
  green: { bg: 'bg-pill-green-bg', text: 'text-success', dot: 'bg-success' },
  warm: { bg: 'bg-pill-warm-bg', text: 'text-like', dot: 'bg-like' },
  amber: { bg: 'bg-pill-amber-bg', text: 'text-warn', dot: 'bg-warn' },
  danger: { bg: 'bg-pill-danger-bg', text: 'text-danger', dot: 'bg-danger' },
};

interface LibraryPillProps {
  tone: PillTone;
  /** Translated text for a word pill. Omit for a glyph-only pill. */
  label?: string;
  /** Emoji shown in place of the tone dot (the like/dislike axis). */
  glyph?: string;
  /** Screen-reader label, required when the pill is glyph-only. */
  accessibilityLabel?: string;
}

export function LibraryPill({ tone, label, glyph, accessibilityLabel }: LibraryPillProps) {
  const classes = TONE[tone];
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      className={`flex-row items-center self-start rounded-full px-2 py-0.5 ${classes.bg}`}
    >
      {glyph ? (
        <Text className="text-[11px]">{glyph}</Text>
      ) : (
        <View className={`me-[5px] h-[5px] w-[5px] rounded-full ${classes.dot}`} />
      )}
      {label ? <Text className={`text-[11px] font-semibold ${classes.text}`}>{label}</Text> : null}
    </View>
  );
}
