/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 preset wires up the react-native CSS interop
  presets: [require('nativewind/preset')],

  // Dark mode via a class on a root element (NativeWind manages the .dark class
  // automatically from colorScheme; components never need `dark:` prefixes when
  // colors are expressed as CSS variables whose values swap per theme).
  darkMode: 'class',

  content: [
    './src/**/*.{ts,tsx}',
    '../../libs/ui-native/src/**/*.{ts,tsx}', // Track B (does not exist yet; safe to include)
  ],

  theme: {
    extend: {
      // ── Colors — mapped to CSS custom properties defined in src/global.css ──
      // Components use semantic class names (bg-bg, text-text-muted, etc.).
      // Hex values live ONLY in global.css; this file never contains a hex value.
      colors: {
        // Canvas
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',

        // Text
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-soft': 'var(--text-soft)',

        // Semantic
        success: 'var(--success)',
        like: 'var(--like)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',

        // Status pill backgrounds
        'pill-green-bg': 'var(--pill-green-bg)',
        'pill-warm-bg': 'var(--pill-warm-bg)',
        'pill-amber-bg': 'var(--pill-amber-bg)',
        'pill-danger-bg': 'var(--pill-danger-bg)',

        // Toast (inverts vs page) + per-tone icon circles
        'toast-bg': 'var(--toast-bg)',
        'toast-fg': 'var(--toast-fg)',
        'toast-muted': 'var(--toast-muted)',
        'toast-success-bg': 'var(--toast-success-bg)',
        'toast-success-fg': 'var(--toast-success-fg)',
        'toast-warm-bg': 'var(--toast-warm-bg)',
        'toast-warm-fg': 'var(--toast-warm-fg)',
        'toast-danger-bg': 'var(--toast-danger-bg)',
        'toast-danger-fg': 'var(--toast-danger-fg)',
        'toast-neutral-bg': 'var(--toast-neutral-bg)',
        'toast-neutral-fg': 'var(--toast-neutral-fg)',
      },

      // ── Border radii (from kebi-tokens-mockup.html §07) ────────────────────
      // Names match design-system vocabulary.
      borderRadius: {
        tiny: '4px',     // tag chips
        small: '7px',    // avatars
        medium: '10px',  // buttons, rows
        card: '12px',    // cards, sheets
        large: '14px',   // group containers
        full: '9999px',  // pills, AI button
      },

      // ── Typography (from kebi-tokens-mockup.html §05) ─────────────────────
      // Tuple format: [fontSize, { lineHeight, letterSpacing }]
      // letter-spacing in NativeWind v4 is passed as a CSS value (px / em).
      fontSize: {
        hero:     ['32px', { lineHeight: '1.05', letterSpacing: '-0.96px' }],
        title:    ['28px', { letterSpacing: '-0.70px' }],
        subtitle: ['18px', { letterSpacing: '-0.27px' }],
        body:     ['15px', { lineHeight: '1.5', letterSpacing: '-0.075px' }],
        small:    ['13px', { letterSpacing: '-0.065px' }],
        eyebrow:  ['11px', { letterSpacing: '0.88px' }],
      },

      // ── Font families (Inter, loaded via expo-font before first render) ─────
      // Each weight is a distinct RN family name; RN cannot synthesise weight.
      // Usage: `font-sans` (400) · `font-medium` (500) · `font-semibold` (600)
      //        `font-bold` (700) · `font-extrabold` (800)
      fontFamily: {
        sans:      ['Inter_400Regular'],
        medium:    ['Inter_500Medium'],
        semibold:  ['Inter_600SemiBold'],
        bold:      ['Inter_700Bold'],
        extrabold: ['Inter_800ExtraBold'],
      },

      // ── Spacing — Tailwind defaults already cover the fixed scale ───────────
      // Scale: 4/8/12/14/16/24/32 == Tailwind 1/2/3/3.5/4/6/8 (1rem=16px).
      // NO custom spacing — discipline rule: only use p-1 p-2 p-3 p-3.5 p-4 p-6 p-8.

      // ── Motion (from kebi-tokens-mockup.html §16) ──────────────────────────
      // `animate-breathe` → the mascot breathing loop (@keyframes in global.css).
      // 2.4s ease-in-out, infinite. Press feedback is the PRESS className token
      // in src/theme/motion.ts (NativeWind transition/active: utilities).
      animation: {
        breathe: 'breathe 2400ms ease-in-out infinite',
      },
    },
  },

  plugins: [],
};
