import { View, type DimensionValue } from 'react-native';
import { STATES } from '../theme/motion';

/**
 * A shimmering block standing in for content that is still on its way
 * (design-system § loading states, ADR-056). Drawn in the exact geometry of what
 * will replace it, so nothing moves when the data lands.
 *
 * Three rules the callers own, not this component:
 * - only what the server owes shimmers — static labels, eyebrows and chevrons never do
 * - only what is guaranteed to arrive shimmers — a section that may resolve to
 *   nothing must not, or the user watches phantom content evaporate
 * - never what we already hold — a seeded navigation paints its known data instead
 *
 * `frozen` is the failed-load state: the loop stops and the block dims, so a
 * screen under an error row reads as paused rather than still trying.
 */

type Radius = 'tiny' | 'small' | 'medium' | 'card' | 'large' | 'full';

const RADIUS_CLASS: Record<Radius, string> = {
  tiny: 'rounded-tiny',
  small: 'rounded-small',
  medium: 'rounded-medium',
  card: 'rounded-card',
  large: 'rounded-large',
  full: 'rounded-full',
};

interface SkeletonProps {
  /** Block height in px — match the line or control it replaces. */
  height: number;
  /** Width; percentages vary the rhythm of stacked text lines. */
  width?: DimensionValue;
  radius?: Radius;
  /** Failed load: stop the loop and dim, rather than shimmering forever. */
  frozen?: boolean;
  className?: string;
}

export function Skeleton({
  height,
  width = '100%',
  radius = 'tiny',
  frozen = false,
  className = '',
}: SkeletonProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width, opacity: frozen ? STATES.frozenOpacity : 1 }}
      className={`bg-surface-2 ${RADIUS_CLASS[radius]} ${frozen ? '' : 'animate-shimmer'} ${className}`}
    />
  );
}

/**
 * A skeleton sitting on a `--surface` card, where `--surface-2` has too little
 * contrast to read. Same component, page-background fill.
 */
export function SkeletonOnSurface(props: SkeletonProps) {
  return <Skeleton {...props} className={`!bg-bg ${props.className ?? ''}`} />;
}
