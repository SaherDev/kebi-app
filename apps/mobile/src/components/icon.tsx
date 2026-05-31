import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import Svg, { Path, Polyline, Circle, Line } from 'react-native-svg';

// Lift the NativeWind text color onto react-native-svg's `color` prop so that
// `stroke="currentColor"` / `fill="currentColor"` resolve to a semantic token.
// Caller controls the tone with a Tailwind text-* class (default text-text);
// no hex literals live in this component.
cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { color: true },
  },
});

export type IconName =
  | 'back'
  | 'close'
  | 'bookmark'
  | 'book'
  | 'gear'
  | 'search'
  | 'edit'
  | 'ellipsis'
  | 'chevron-right'
  | 'check'
  | 'plus'
  | 'pin';

// Path data verbatim from docs/kebi-app-design-system mockups (top-bar icons)
// and kebi-tokens-mockup.html §15. viewBox 0 0 24 24, 1.8px stroke, fill none —
// except `ellipsis`, which is three filled dots.
const ICONS: Record<IconName, ReactNode> = {
  back: <Polyline points="15 6 9 12 15 18" />,
  close: <Path d="M18 6L6 18M6 6l12 12" />,
  bookmark: <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />,
  book: (
    <>
      <Path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </>
  ),
  gear: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={8} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} />
    </>
  ),
  edit: <Path d="M12 20h9M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4z" />,
  'chevron-right': <Polyline points="9 6 15 12 9 18" />,
  check: <Polyline points="20 6 9 17 4 12" />,
  plus: (
    <>
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </>
  ),
  ellipsis: (
    <>
      <Circle cx={5} cy={12} r={1.5} fill="currentColor" stroke="none" />
      <Circle cx={12} cy={12} r={1.5} fill="currentColor" stroke="none" />
      <Circle cx={19} cy={12} r={1.5} fill="currentColor" stroke="none" />
    </>
  ),
  pin: (
    <>
      <Circle cx={12} cy={10} r={3} />
      <Path d="M12 2a8 8 0 00-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 00-8-8z" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  /** Rendered px size (icons are authored on a 24×24 viewBox). */
  size?: number;
  /** Tailwind text-* class picking the stroke/fill tone. */
  className?: string;
}

export function Icon({ name, size = 18, className = 'text-text' }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={1.8}
    >
      {ICONS[name]}
    </Svg>
  );
}
