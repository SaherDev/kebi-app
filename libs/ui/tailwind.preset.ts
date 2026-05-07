import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        // Core semantic colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Sidebar variants
        sidebar: {
          background: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        // Extended palette
        surface: "hsl(var(--color-surface))",
        "surface-raised": "hsl(var(--color-surface-raised))",
        "text-primary": "hsl(var(--color-text-primary))",
        "text-secondary": "hsl(var(--color-text-secondary))",
        "text-tertiary": "hsl(var(--color-text-tertiary))",
        "accent-gold": "hsl(var(--color-accent-gold))",
        "accent-gold-soft": "hsl(var(--color-accent-gold-soft))",
        forest: "hsl(var(--color-forest))",
        "forest-soft": "hsl(var(--color-forest-soft))",
        cream: "hsl(var(--color-cream))",
        "warm-white": "hsl(var(--color-warm-white))",
      },
      borderRadius: {
        "3xl": "1.75rem",
        "2xl": "1.25rem",
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "kebi-app-sm": "var(--shadow-sm)",
        "kebi-app-md": "var(--shadow-md)",
        "kebi-app-lg": "var(--shadow-lg)",
        "kebi-app-glow": "var(--shadow-glow)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.025)" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-3px) rotate(1.5deg)" },
        },
        sway: {
          "0%, 100%": { transform: "rotate(-2.5deg)" },
          "50%": { transform: "rotate(2.5deg)" },
        },
        "sway-gentle": {
          "0%, 100%": { transform: "rotate(-1.5deg)" },
          "50%": { transform: "rotate(1.5deg)" },
        },
        nod: {
          "0%, 60%, 100%": { transform: "rotate(0deg)" },
          "30%": { transform: "rotate(6deg)" },
        },
        peek: {
          "0%, 100%": { transform: "translateY(0)" },
          "30%, 60%": { transform: "translateY(-5px)" },
        },
        bounce: {
          "0%, 100%": { transform: "translateY(0)" },
          "25%": { transform: "translateY(-6px)" },
          "50%": { transform: "translateY(0)" },
          "75%": { transform: "translateY(-3px)" },
        },
        "eye-blink": {
          "0%, 42%, 48%, 100%": { transform: "scaleY(1)" },
          "45%": { transform: "scaleY(0.08)" },
        },
        "star-twinkle": {
          "0%, 100%": { opacity: "0.85", transform: "scale(1)" },
          "50%": { opacity: "0.2", transform: "scale(0.6)" },
        },
        "rain-fall": {
          "0%": { transform: "translateY(0)", opacity: "0.7" },
          "100%": { transform: "translateY(8px)", opacity: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.55" },
        },
        "line-pulse": {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "0.2" },
        },
        "leaf-pulse": {
          "0%, 100%": { opacity: "0.85", transform: "scale(1)" },
          "50%": { opacity: "0.2", transform: "scale(0.6)" },
        },
      },
      animation: {
        breathe: "breathe 3.2s ease-in-out infinite",
        bob: "bob 2.8s ease-in-out infinite",
        float: "float 3.5s ease-in-out infinite",
        sway: "sway 3.0s ease-in-out infinite",
        "sway-gentle": "sway-gentle 4.0s ease-in-out infinite",
        nod: "nod 3.0s ease-in-out infinite",
        peek: "peek 3.5s ease-in-out infinite",
        bounce: "bounce 2.0s ease-in-out infinite",
        "eye-blink": "eye-blink 4.0s ease-in-out infinite",
        "star-twinkle": "star-twinkle 2.0s ease-in-out infinite",
        "rain-fall": "rain-fall 1.8s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "line-pulse": "line-pulse 2.0s ease-in-out infinite",
        "leaf-pulse": "leaf-pulse 2.0s ease-in-out infinite",
      },
    },
  },
};

export default config;
