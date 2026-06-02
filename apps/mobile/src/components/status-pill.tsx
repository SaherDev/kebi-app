import type { ReactNode } from 'react';
import { View, Text } from 'react-native';

/**
 * Small colored-dot label for a single piece of state (kebi-tokens-mockup.html
 * `.pill` + `.pill.green/.warm/.amber/.danger`). Four variants only — map any
 * new state onto one of these, never invent a colour:
 *   green = saved/went · warm = new · amber = approve? · danger = closed.
 *
 * Light/dark is automatic: every variant resolves to `--pill-*-bg` (tint) plus
 * a semantic tone (`--success/--like/--warn/--danger`) that swap per scheme via
 * the CSS variables in global.css — no `useColorScheme` needed.
 */
type StatusVariant = 'green' | 'warm' | 'amber' | 'danger';

interface StatusPillProps {
  variant: StatusVariant;
  /** The state label, e.g. `saved`, `new`. Pass an already-translated string. */
  children: ReactNode;
}

// Per-variant token classes: [pill background, dot background, text tone].
const VARIANT: Record<StatusVariant, { bg: string; dot: string; text: string }> = {
  green: { bg: 'bg-pill-green-bg', dot: 'bg-success', text: 'text-success' },
  warm: { bg: 'bg-pill-warm-bg', dot: 'bg-like', text: 'text-like' },
  amber: { bg: 'bg-pill-amber-bg', dot: 'bg-warn', text: 'text-warn' },
  danger: { bg: 'bg-pill-danger-bg', dot: 'bg-danger', text: 'text-danger' },
};

export function StatusPill({ variant, children }: StatusPillProps) {
  const v = VARIANT[variant];
  return (
    <View className={`flex-row items-center self-start rounded-full px-2.5 py-[3px] ${v.bg}`}>
      <View className={`h-[5px] w-[5px] rounded-full me-[5px] ${v.dot}`} />
      <Text className={`text-[11px] font-semibold ${v.text}`}>{children}</Text>
    </View>
  );
}
