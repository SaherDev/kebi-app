import type { ReactNode } from 'react';
import { cssInterop } from 'nativewind';
import Svg, { Path, Polyline, Circle, Line, Rect } from 'react-native-svg';

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
  | 'share-in'
  | 'book'
  | 'gear'
  | 'search'
  | 'edit'
  | 'ellipsis'
  | 'chevron-right'
  | 'arrow-right'
  | 'check'
  | 'plus'
  | 'pin'
  | 'copy'
  | 'eye'
  | 'trash'
  | 'alert'
  | 'link'
  | 'mail'
  | 'phone';

// Path data verbatim from docs/kebi-app-design-system mockups (top-bar icons)
// and kebi-tokens-mockup.html §15. viewBox 0 0 24 24, 1.8px stroke, fill none —
// except `ellipsis`, which is three filled dots.
const ICONS: Record<IconName, ReactNode> = {
  back: <Polyline points="15 6 9 12 15 18" />,
  close: <Path d="M18 6L6 18M6 6l12 12" />,
  // share-in: tray + arrow dropping in — the save trigger. "drop it in" voice.
  'share-in': (
    <>
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <Polyline points="8 11 12 15 16 11" />
      <Line x1={12} y1={3} x2={12} y2={15} />
    </>
  ),
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
  // Full arrow → for forward CTAs (the login send-code button).
  'arrow-right': (
    <>
      <Line x1={5} y1={12} x2={19} y2={12} />
      <Polyline points="12 5 19 12 12 19" />
    </>
  ),
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
  // Toast glyphs (kebi-toasts-dark-mockup.html).
  copy: (
    <>
      <Rect x={9} y={9} width={13} height={13} rx={2} />
      <Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </>
  ),
  eye: (
    <>
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  trash: (
    <>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </>
  ),
  alert: (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Line x1={12} y1={8} x2={12} y2={12} />
      <Line x1={12} y1={16} x2={12.01} y2={16} />
    </>
  ),
  // Save-sheet source meta hint (kebi-save-sheet-mockup.html `.sheet-input-meta`).
  link: (
    <>
      <Path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </>
  ),
  // Smart-input meta hints (kebi-login-email-mockup.html `.input-meta`).
  mail: (
    <>
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Polyline points="22 6 12 13 2 6" />
    </>
  ),
  phone: (
    <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" />
  ),
};

interface IconProps {
  name: IconName;
  /** Rendered px size (icons are authored on a 24×24 viewBox). */
  size?: number;
  /** Tailwind text-* class picking the stroke/fill tone. */
  className?: string;
  /** Stroke width on the 24×24 viewBox. Defaults to 1.8 (feather weight); the
   *  reasoning done-node check is drawn heavier (3) at its small 8px size. */
  strokeWidth?: number;
}

export function Icon({ name, size = 18, className = 'text-text', strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      stroke="currentColor"
      fill="none"
      strokeWidth={strokeWidth}
    >
      {ICONS[name]}
    </Svg>
  );
}
