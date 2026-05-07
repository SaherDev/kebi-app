/**
 * Typed Design Token Exports
 *
 * All values correspond to CSS custom properties defined in libs/ui/styles/tokens.css
 * Use these for programmatic access to design tokens in dynamic styles
 *
 * For Tailwind class-based styling, use semantic color classes directly:
 * - bg-primary, text-foreground, border-border, etc.
 */

export const tokens = {
  colors: {
    // Semantic colors (primary palette)
    primary: 'hsl(var(--primary))',
    'primary-foreground': 'hsl(var(--primary-foreground))',
    secondary: 'hsl(var(--secondary))',
    'secondary-foreground': 'hsl(var(--secondary-foreground))',
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    muted: 'hsl(var(--muted))',
    'muted-foreground': 'hsl(var(--muted-foreground))',
    accent: 'hsl(var(--accent))',
    'accent-foreground': 'hsl(var(--accent-foreground))',
    destructive: 'hsl(var(--destructive))',
    'destructive-foreground': 'hsl(var(--destructive-foreground))',
    border: 'hsl(var(--border))',
    input: 'hsl(var(--input))',
    ring: 'hsl(var(--ring))',

    // Extended palette
    forest: 'hsl(var(--forest))',
    'forest-soft': 'hsl(var(--forest-soft))',
    gold: 'hsl(var(--gold))',
    'gold-soft': 'hsl(var(--gold-soft))',
    cream: 'hsl(var(--cream))',
    'warm-white': 'hsl(var(--warm-white))',
    surface: 'hsl(var(--surface))',

    // Sidebar colors
    sidebar: 'hsl(var(--sidebar))',
    'sidebar-foreground': 'hsl(var(--sidebar-foreground))',
    'sidebar-accent': 'hsl(var(--sidebar-accent))',
    'sidebar-accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    'sidebar-border': 'hsl(var(--sidebar-border))',
  } as const,

  shadows: {
    'kebi-app-sm': 'var(--shadow-kebi-app-sm)',
    'kebi-app-md': 'var(--shadow-kebi-app-md)',
    'kebi-app-lg': 'var(--shadow-kebi-app-lg)',
    'kebi-app-glow': 'var(--shadow-kebi-app-glow)',
  } as const,

  radius: {
    default: 'var(--radius)',
    lg: 'calc(var(--radius) + 0.5rem)',
    md: 'var(--radius)',
    sm: 'calc(var(--radius) - 0.25rem)',
  } as const,

  fontFamily: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
  } as const,

  // Animation durations (in milliseconds, for JS-based animations)
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  } as const,

  // Spacing scale (maps to Tailwind's spacing)
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
  } as const,
} as const;

// Type exports for advanced usage
export type ColorToken = keyof typeof tokens.colors;
export type ShadowToken = keyof typeof tokens.shadows;
export type RadiusToken = keyof typeof tokens.radius;
export type FontFamilyToken = keyof typeof tokens.fontFamily;
export type SpacingToken = keyof typeof tokens.spacing;
