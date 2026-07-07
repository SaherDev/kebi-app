import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Mascot } from './mascot';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';
import { triggerHaptic } from '../lib/haptics';

interface KebiFabProps {
  onPress?: () => void;
}

/** Diameter (px) of the floating AI button — `h-16 w-16` in the home mockup. */
export const FAB_SIZE = 64;
/** Distance (px) from the screen's right edge to the button. */
export const FAB_EDGE_INSET = 16;

/**
 * The single floating AI button — 64px circle, 16px from the right and sitting
 * just above the home indicator (anchored at the bottom safe-area edge, matching
 * the home mockup — NOT `insets.bottom + 16`, which floats it too high).
 * Brightest spot on screen: pure white in light mode (border-only), cream-filled
 * in dark. No tab bar. Inverted vs the page, so the fill is chosen per scheme,
 * not via `dark:`. (kebi-tokens-mockup.html §09 + §18.)
 */
export function KebiFab({ onPress }: KebiFabProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('fab-tap');
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('nav.askKebi')}
      className={`absolute items-center justify-center rounded-full ${PRESS} ${
        dark ? 'bg-text' : 'border border-surface-2 bg-white'
      }`}
      style={{ width: FAB_SIZE, height: FAB_SIZE, right: FAB_EDGE_INSET, bottom: insets.bottom }}
    >
      <Mascot size={42} />
    </Pressable>
  );
}
