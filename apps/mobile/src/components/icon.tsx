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
  | 'phone'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'sparkle'
  | 'sort'
  | 'filter'
  | 'image'
  | 'mic';

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
  // Library source-line glyphs: the official single-colour brand marks
  // (simple-icons paths, 24×24). Filled — override the default stroke render.
  instagram: (
    <Path
      fill="currentColor"
      stroke="none"
      d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"
    />
  ),
  // TikTok: the official logo, not a generic note.
  tiktok: (
    <Path
      fill="currentColor"
      stroke="none"
      d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.08-.14 1.62.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
    />
  ),
  youtube: (
    <Path
      fill="currentColor"
      stroke="none"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
    />
  ),
  sparkle: <Path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
  // Chat editor toolbar (kebi-chat-mockup.html `.toolbar`): photo + voice.
  image: (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} />
      <Path d="M21 15l-5-5L5 21" />
    </>
  ),
  mic: (
    <>
      <Rect x={9} y={2} width={6} height={12} rx={3} />
      <Path d="M5 10v2a7 7 0 0014 0v-2M12 19v3" />
    </>
  ),
  // Library toolbar (kebi-library-mockup.html `.toolbar-btn`): sort lines + funnel.
  sort: <Path d="M3 6h18M6 12h12M10 18h4" />,
  filter: <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
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
