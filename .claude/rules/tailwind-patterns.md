# Tailwind Patterns — Kebi

Reference examples showing how Tailwind v3 + shadcn/ui is used across the system.

---

## 1. Tailwind Config (tailwind.config.js)

Colors are mapped from CSS variables in the Tailwind config. This is the v3 way — no `@theme` directive.

```js
// apps/web/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../libs/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

---

## 2. CSS Variables (globals.css)

Variables use raw HSL values (no `hsl()` wrapper) so Tailwind can apply opacity modifiers like `bg-primary/90`.

```css
/* apps/web/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 262 80% 50%;
    --primary-foreground: 0 0% 98%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 262 80% 95%;
    --accent-foreground: 262 80% 20%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --ring: 262 80% 50%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 262 80% 60%;
    --primary-foreground: 240 10% 3.9%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 262 80% 15%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 50.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --ring: 262 80% 60%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

To swap the entire palette, change only these variable values. No component code changes.

---

## 3. The `cn()` Utility

shadcn/ui uses `clsx` + `tailwind-merge` to safely merge class names. Every component uses this.

```ts
// libs/ui/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Usage — last class wins, no conflicts:

```tsx
<div className={cn('rounded-lg bg-primary', isActive && 'bg-accent', className)} />
```

---

## 4. Semantic Classes — Never Raw Colors

```tsx
// CORRECT
<button className="bg-primary text-primary-foreground rounded-lg px-4 py-2">
  Recommend
</button>

// WRONG
<button className="bg-purple-600 text-white rounded-lg px-4 py-2">
  Recommend
</button>
```

---

## 5. RTL / Logical Properties (reserved for future Hebrew locale)

Use logical property utilities instead of physical directions.

```tsx
// CORRECT
<div className="flex items-center gap-3 ps-4 pe-2 ms-2 text-start">
  <MapPinIcon className="size-5 text-muted-foreground" />
  <span className="text-foreground">{placeName}</span>
</div>

// WRONG
<div className="flex items-center gap-3 pl-4 pr-2 ml-2 text-left">
  ...
</div>
```

### Quick Reference

| Physical (don't use) | Logical (use this) |
|-----------------------|--------------------|
| `ml-*`                | `ms-*`             |
| `mr-*`                | `me-*`             |
| `pl-*`                | `ps-*`             |
| `pr-*`                | `pe-*`             |
| `left-*`              | `start-*`          |
| `right-*`             | `end-*`            |
| `text-left`           | `text-start`       |
| `text-right`          | `text-end`         |
| `border-l`            | `border-s`         |
| `border-r`            | `border-e`         |
| `rounded-l`           | `rounded-s`        |
| `rounded-r`           | `rounded-e`        |

---

## 6. Component Example — Place Card

Shows all rules together: semantic tokens, logical properties, i18n strings, `cn()`.

```tsx
// apps/web/src/components/place-card.tsx
import { useTranslations } from 'next-intl';
import { cn } from '@kebi-app/ui';

interface PlaceCardProps {
  placeName: string;
  address: string;
  reasoning: string;
  source: 'saved' | 'discovered';
  className?: string;
}

export function PlaceCard({ placeName, address, reasoning, source, className }: PlaceCardProps) {
  const t = useTranslations('recommendation');

  return (
    <article className={cn('rounded-xl border border-border bg-background p-5 shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{placeName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{address}</p>
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-xs font-medium',
          {
            'bg-accent text-accent-foreground': source === 'saved',
            'bg-muted text-muted-foreground': source === 'discovered',
          }
        )}>
          {t(`source.${source}`)}
        </span>
      </div>

      {/* Reasoning */}
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {reasoning}
      </p>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {t('action.goHere')}
        </button>
        <button className="rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/80">
          {t('action.showAlternatives')}
        </button>
      </div>
    </article>
  );
}
```

---

## 7. Design System Components (libs/ui)

Shared primitives use `class-variance-authority` + `cn()` for variant management. This is the shadcn/ui pattern.

```tsx
// libs/ui/src/components/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        muted: 'bg-muted text-muted-foreground hover:bg-muted/80',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 rounded-md px-3',
        default: 'h-10 px-4 py-2',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

---

## Summary

| Rule                      | Example                                          |
|---------------------------|--------------------------------------------------|
| No raw colors             | `bg-primary` not `bg-purple-600`                 |
| No physical directions    | `ps-4 me-2` not `pl-4 mr-2`                     |
| No hardcoded strings      | `t('action.goHere')` not `"Go here"`            |
| Dark mode via variables   | `.dark { --background: ... }` — components stay  |
| Palette swap              | Change `:root` / `.dark` values only             |
| Shared components         | `libs/ui` with `cva` + `cn()` for variants       |
| Class merging             | Always use `cn()` — never string concatenation   |
| HSL variables             | Raw values `262 80% 50%` — Tailwind adds `hsl()` |
