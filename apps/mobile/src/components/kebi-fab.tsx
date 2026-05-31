import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Mascot } from './mascot';

interface KebiFabProps {
  onPress?: () => void;
}

/**
 * The single floating AI button — 56px circle, 16px from the right and sitting
 * just above the home indicator (anchored at the bottom safe-area edge, matching
 * the home mockup — NOT `insets.bottom + 16`, which floats it too high).
 * Brightest spot on screen: pure white in light mode (border-only), cream-filled
 * in dark. No tab bar. Inverted vs the page, so the fill is chosen per scheme,
 * not via `dark:`. (kebi-tokens-mockup.html §09 + §18.)
 */
export function KebiFab({ onPress }: KebiFabProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="ask kebi"
      className={`absolute h-14 w-14 items-center justify-center rounded-full ${
        dark ? 'bg-text' : 'border border-surface-2 bg-white'
      }`}
      style={{ right: 16, bottom: insets.bottom }}
    >
      <Mascot size={36} />
    </Pressable>
  );
}
