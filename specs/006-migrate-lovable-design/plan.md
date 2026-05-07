# Implementation Plan: Migrate Lovable Design Output into Kebi Nx Monorepo

**Branch**: `001-migrate-lovable-design` | **Date**: 2026-03-12 | **Spec**: [spec.md](./spec.md)

## Summary

Migrate the Lovable-generated `kebi-app-guide-bot` Vite+React app design output into the Kebi Nx monorepo (`apps/web` + `libs/ui`). The migration establishes `libs/ui` as the self-contained design system (owning the Tailwind preset, CSS token stylesheet, and generic UI primitives), migrates 14 Kebi-specific components to `apps/web/src/components/`, converts 3 screens to Next.js App Router pages, moves i18n to `apps/web/messages/`, and copies 19 SVG illustrations to `apps/web/public/illustrations/`.

**⚠️ APPROVAL REQUIRED before Phase D**: `framer-motion` is used in all 3 screens. If not approved, screens use `tailwindcss-animate` CSS alternatives instead.

## Technical Context

**Language/Version**: TypeScript 5.x / Node 20 LTS
**Primary Dependencies**: Next.js 16, Tailwind v3, shadcn/ui, next-intl, next-themes, tailwindcss-animate (already installed), framer-motion (pending approval), next/font/google
**Storage**: N/A (frontend-only migration)
**Testing**: pnpm lint + pnpm build (no new unit tests — visual migration)
**Target Platform**: Browser (Next.js App Router, SSR + client components)
**Project Type**: Frontend migration
**Performance Goals**: No layout shift from fonts; zero broken styles on first render
**Constraints**: No new packages without approval; Nx boundary rules enforced; Tailwind v3 only (ADR-007)
**Scale/Scope**: 3 screens, 12 shadcn primitives, 14 Kebi-specific components, 1 design token system, 19 SVG assets

## Constitution Check

| Gate                                              | Status  | Notes                                                                                    |
| ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| Two-Repo Boundary (I)                             | ✅ PASS | Frontend-only. No NestJS changes. No AI calls.                                           |
| Nx Module Boundaries (II)                         | ✅ PASS | `libs/ui` → nothing; `apps/web` → `libs/ui`, `libs/shared`; no cross-boundary violations |
| ADR-007: Tailwind v3 + shadcn/ui                  | ✅ PASS | Lovable components use Tailwind v3 + CVA pattern                                         |
| ADR-020: pnpm                                     | ✅ PASS | No package manager changes                                                               |
| Frontend Standards (VII): semantic tokens         | ✅ PASS | Spec requires zero hardcoded colors                                                      |
| Frontend Standards (VII): RTL logical properties  | ✅ PASS | Lovable components need audit; physical properties replaced                              |
| Frontend Standards (VII): next-intl               | ✅ PASS | Lovable i18next config discarded; JSON content reused                                    |
| Frontend Standards (VII): libs/ui with cva + cn() | ✅ PASS | All migrated primitives use CVA pattern                                                  |
| Code Standards (VIII): kebab-case files           | ✅ PASS | All migrated files renamed on arrival                                                    |
| No hardcoded strings (IV)                         | ✅ PASS | All UI strings via next-intl `useTranslations()`                                         |

**No constitution violations. No ADR conflicts. Safe to proceed.**

## Project Structure

### Documentation (this feature)

```text
specs/001-migrate-lovable-design/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
libs/ui/
├── tailwind.preset.ts           ← NEW: Tailwind theme preset (fonts, colors, shadows, animations)
├── styles/
│   └── tokens.css               ← NEW: All CSS custom properties (light + dark)
└── src/
    ├── index.ts                 ← UPDATED: export all new components
    └── components/              ← NEW directory
        ├── button.tsx           ← REPLACE existing (Lovable version)
        ├── badge.tsx            ← NEW
        ├── avatar.tsx           ← NEW
        ├── card.tsx             ← NEW
        ├── input.tsx            ← NEW
        ├── dialog.tsx           ← NEW (used as Modal primitive)
        ├── scroll-area.tsx      ← NEW
        ├── separator.tsx        ← NEW
        ├── skeleton.tsx         ← NEW
        ├── tabs.tsx             ← NEW
        ├── tooltip.tsx          ← NEW
        └── dropdown-menu.tsx    ← NEW

apps/web/
├── tailwind.config.js           ← UPDATED: consume libs/ui preset
├── messages/                    ← MOVED from repo root + Lovable content merged
│   ├── en.json                  ← UPDATED: Lovable translations merged in
│   └── he.json                  ← UPDATED: Lovable Hebrew translations merged in
├── public/
│   └── illustrations/           ← NEW directory
│       ├── kebi-app-auth.svg
│       ├── kebi-app-splash.svg
│       ├── kebi-app-home-input.svg
│       └── ... (19 SVGs total)
└── src/
    ├── app/
    │   ├── globals.css          ← UPDATED: import tokens.css, add animation CSS
    │   ├── layout.tsx           ← UPDATED: next/font/google, SplashScreen
    │   ├── (auth)/
    │   │   └── login/
    │   │       └── page.tsx     ← NEW: AuthScreen
    │   └── (main)/
    │       └── page.tsx         ← NEW: HomeScreen
    ├── components/
    │   ├── splash-screen.tsx    ← NEW: SplashScreen with localStorage
    │   ├── illustrations/
    │   │   └── kebi-app-illustrations.tsx  ← NEW: SVG wrapper components
    │   ├── agent-response-bubble.tsx
    │   ├── agent-step.tsx
    │   ├── chat-input.tsx
    │   ├── chat-message.tsx
    │   ├── empty-state.tsx
    │   ├── language-switcher.tsx
    │   ├── loading-state.tsx
    │   ├── modal.tsx
    │   ├── nav-bar.tsx
    │   ├── nav-link.tsx
    │   ├── place-card.tsx
    │   ├── profile-menu.tsx
    │   ├── reasoning-block.tsx
    │   ├── tag.tsx
    │   ├── theme-toggle.tsx
    │   ├── kebi-app-avatar.tsx
    │   └── kebi-app-card.tsx
    └── styles/
        └── tokens.ts            ← NEW: typed JS token exports
```

## Phase A: Design System Foundation

**Goal**: `libs/ui` becomes self-contained design system. Nothing compiles until this is done — all components depend on these tokens.

### A1 — Create `libs/ui/styles/tokens.css`

Move ALL CSS custom properties from Lovable's `index.css` into this file:

- Light theme: `:root` and `[data-theme="light"]` blocks
  - Core semantic: `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--ring`, `--radius`
  - Extended: `--forest-*`, `--gold-*`, `--cream-*`, `--warm-white-*`, `--surface`
  - Sidebar: `--sidebar-*` (all sidebar tokens)
  - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
  - Typography: `--font-display`, `--font-body`
- Dark theme: `.dark` and `[data-theme="dark"]` blocks (all same tokens, dark values)
- `@layer utilities`: `.shadow-kebi-app-sm`, `.shadow-kebi-app-md`, `.shadow-kebi-app-lg`, `.shadow-kebi-app-glow`, `.font-display`, `.font-body`
- `@layer base`: `html { font-family: var(--font-body) }`, `h1-h4 { font-family: var(--font-display) }`, `body { @apply bg-background text-foreground antialiased }`

### A2 — Create `libs/ui/tailwind.preset.ts`

```ts
export default {
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        // All semantic colors referencing CSS variables
        // Core: background, foreground, primary, secondary, accent, muted, destructive, border, input, ring
        // Extended: forest, gold, cream, warm-white, surface, sidebar (all variants)
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
        // accordion-down, accordion-up, fade-in, slide-up, breathe
      },
      animation: {
        // all five + organic animations from animations.css
      },
    },
  },
};
```

### A3 — Update `apps/web/tailwind.config.js`

- Add `const preset = require('../../libs/ui/tailwind.preset')` (or relative path)
- Add `presets: [preset]` to config
- Remove any duplicated theme values now covered by the preset
- Keep `content` paths unchanged
- Keep `darkMode: 'class'`
- Keep `tailwindcss-animate` plugin

### A4 — Update `apps/web/src/app/globals.css`

- Keep `@tailwind base/components/utilities` directives
- Add `@import '../../../libs/ui/styles/tokens.css'` (or relative path from globals.css)
- Remove existing `:root` and `.dark` variable blocks (now in tokens.css)
- Add Lovable's `src/styles/animations.css` content (organic keyframes: breathe, bob, float, sway, etc.)

### A5 — Update `apps/web/src/app/layout.tsx`

- Add `next/font/google` for DM Serif Display and DM Sans
- Apply both font CSS variables to `<body>` via className
- Wire up `next-themes` ThemeProvider (if not already)

**Verify A**: Run `pnpm nx build web` — must compile with no missing class errors.

---

## Phase B: Assets

**Goal**: All SVGs available at `/illustrations/*` in the browser.

### B1 — Copy SVG files

Copy all 19 files from `~/dev/others-repos/kebi-app-guide-bot/src/assets/` to `apps/web/public/illustrations/`. File names unchanged (already kebab-case).

### B2 — Migrate `KebiIllustrations.tsx`

- Source: `src/components/illustrations/KebiIllustrations.tsx`
- Target: `apps/web/src/components/illustrations/kebi-app-illustrations.tsx`
- Conversion: Replace `import` statements of local SVGs with `next/image` or `<img>` pointing to `/illustrations/kebi-app-*.svg`
- Add `'use client'` if any browser API is used
- Export all illustration components

**Verify B**: Start dev server, confirm `/illustrations/kebi-app-auth.svg` loads in browser.

---

## Phase C: `libs/ui` Generic Primitives

**Goal**: 12 shadcn/ui components migrated to `libs/ui/src/components/` and exported.

**Prerequisite**: Phase A complete (preset + tokens in place).

For each component, the migration steps are:

1. Copy from `src/components/ui/<name>.tsx`
2. Rename to `kebab-case.tsx` (already correct)
3. Replace Lovable's `@/lib/utils` import with `../utils` (relative within libs/ui)
4. Replace Lovable's `@/components/ui/*` cross-imports with relative paths within `libs/ui/src/components/`
5. Audit for physical direction properties (`ml/mr/pl/pr/left/right`) → replace with logical (`ms/me/ps/pe/start/end`)
6. Verify no hardcoded colors (all semantic)
7. Export from `libs/ui/src/index.ts`

### C1 — `button.tsx` (replaces existing)

Replace current `libs/ui/src/lib/button.tsx` with Lovable's version. Lovable has more variants (hero, secondary, destructive, link, xl size).

### C2 — `badge.tsx`

### C3 — `avatar.tsx`

### C4 — `card.tsx`

### C5 — `input.tsx`

### C6 — `dialog.tsx`

### C7 — `scroll-area.tsx`

### C8 — `separator.tsx`

### C9 — `skeleton.tsx`

### C10 — `tabs.tsx`

### C11 — `tooltip.tsx`

### C12 — `dropdown-menu.tsx`

### C13 — Update `libs/ui/src/index.ts`

Export all new components. Move existing `lib/button` export to `components/button`.

**Verify C**: `pnpm nx build ui` must pass. Import `@kebi-app/ui` in a test file — all exports resolve.

---

## Phase D: `apps/web` Kebi-Specific Components

**Goal**: All 14 Kebi-specific components + SplashScreen migrated to `apps/web/src/components/`.

**⚠️ APPROVAL GATE**: Before starting Phase D, confirm with developer whether `framer-motion` is approved. If yes, install and use. If no, replace all `motion.div` / `AnimatePresence` with Tailwind CSS animation classes using `tailwindcss-animate`.

For each component, migration steps are:

1. Copy from `src/components/<ComponentName>.tsx`
2. Rename to `kebab-case.tsx`
3. Add `'use client'` if uses useState, useEffect, onClick, or any browser API
4. Replace `react-router-dom` imports: `useNavigate` → `useRouter` from `next/navigation`; `<Link>` → `next/link`
5. Replace i18n: `useTranslation()` from i18next → `useTranslations()` from next-intl
6. Replace `import.meta.env.*` with `process.env.NEXT_PUBLIC_*`
7. Replace `@/components/ui/*` imports → `@kebi-app/ui`
8. Replace `@/lib/utils` → `@kebi-app/ui` (re-exports cn())
9. Audit for RTL violations (physical → logical Tailwind properties)
10. Verify all TypeScript types explicit (no `any`)

### D1 — `agent-response-bubble.tsx`

### D2 — `agent-step.tsx`

### D3 — `chat-input.tsx`

### D4 — `chat-message.tsx`

### D5 — `empty-state.tsx`

### D6 — `language-switcher.tsx` — uses next-intl's `useLocale()` and `useRouter()` for locale switching

### D7 — `loading-state.tsx`

### D8 — `modal.tsx` — wraps `dialog.tsx` from `@kebi-app/ui`

### D9 — `nav-bar.tsx`

### D10 — `nav-link.tsx` — uses `next/link` and `usePathname` for active state

### D11 — `place-card.tsx`

### D12 — `profile-menu.tsx`

### D13 — `reasoning-block.tsx`

### D14 — `tag.tsx`

### D15 — `theme-toggle.tsx` — uses `next-themes` `useTheme()`

### D16 — `kebi-app-avatar.tsx`

### D17 — `kebi-app-card.tsx`

### D18 — `splash-screen.tsx` (NEW)

```tsx
"use client";
// Reads localStorage key 'kebi-app-splash-seen' on mount
// If not set: renders splash animation, sets key on dismiss
// If set: returns null (renders nothing)
// Uses SplashScreen content from Lovable's SplashScreen.tsx
// Replace framer-motion with CSS animation alternative if not approved
```

**Verify D**: Each component renders in isolation without TypeScript errors (`pnpm nx typecheck web`).

---

## Phase E: Screens → Next.js Pages

**Goal**: 3 screens accessible as Next.js App Router routes.

### E1 — AuthScreen → `apps/web/src/app/(auth)/login/page.tsx`

- Source: `src/screens/AuthScreen.tsx`
- Remove `useNavigate` — replace click handlers with `useRouter().push()`
- Remove framer-motion OR replace with CSS alternatives
- Replace i18next with `useTranslations('auth')`
- Add `'use client'` (has state/click handlers)
- Import KebiAuth illustration from `apps/web/src/components/illustrations/kebi-app-illustrations`
- Auth buttons are UI-only (no real auth wiring in this migration — Clerk integration is separate)
- Create `apps/web/src/app/(auth)/layout.tsx` if needed for layout isolation

### E2 — HomeScreen → `apps/web/src/app/(main)/page.tsx`

- Source: `src/screens/HomeScreen.tsx`
- Add `'use client'` (heavy state management)
- Replace `useNavigate` with `useRouter()`
- Replace i18next with `useTranslations('home')`
- Replace framer-motion with CSS alternatives OR keep if approved
- Import all Kebi-specific components from `apps/web/src/components/`
- Create `apps/web/src/app/(main)/layout.tsx` if needed

### E3 — SplashScreen integration in `apps/web/src/app/layout.tsx`

- Import `<SplashScreen />` from `apps/web/src/components/splash-screen`
- Render conditionally in root layout (the component self-manages via localStorage)

**Verify E**: `pnpm nx dev web` — visit `/login` and `/` — both screens render.

---

## Phase F: i18n Migration

**Goal**: Lovable translations in `apps/web/messages/`, next-intl reading from new location.

### F1 — Move `messages/` directory

Move `messages/` from repo root to `apps/web/messages/`.

### F2 — Update next-intl config

Find next-intl config (likely `apps/web/next-intl.config.ts` or `next.config.js`) — update path to `./messages` (relative to apps/web).

### F3 — Merge Lovable translations

Merge `src/i18n/en.json` (101 lines, 10 namespaces) into `apps/web/messages/en.json`. Lovable wins on conflicts. Same for `he.json`.

Key namespaces added: `splash`, `auth`, `home`, `chat`, `agent`, `addPlace`, `result`, `place`, `profile`, `loading`, `notFound`.

### F4 — Update component imports

Verify all components use `useTranslations('namespace')` matching the new key structure.

**Verify F**: Both locales load in browser. RTL layout works for Hebrew.

---

## Phase G: Typed Token Exports

**Goal**: `apps/web/src/styles/tokens.ts` exports all token values as typed TypeScript.

### G1 — Create `tokens.ts`

```ts
export const tokens = {
  colors: {
    primary: "hsl(var(--primary))",
    background: "hsl(var(--background))",
    // ... all tokens mirroring libs/ui/styles/tokens.css
  },
  shadows: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
    glow: "var(--shadow-glow)",
  },
  radius: {
    default: "var(--radius)",
    // ...
  },
  // typography, spacing
} as const;
```

Every key must correspond to a CSS variable in `libs/ui/styles/tokens.css`. No mismatches.

---

## Phase H: Verification

### H1 — Lint

```bash
pnpm nx run-many -t lint --projects=web,ui
```

Zero errors. Zero inline ESLint disables without comments.

### H2 — Build

```bash
pnpm nx build web
pnpm nx build ui
```

Zero errors.

### H3 — Visual check

Start dev server, verify:

- `/` — HomeScreen renders
- `/login` — AuthScreen renders
- First visit: SplashScreen appears and dismisses
- Subsequent visits: SplashScreen does not appear
- Dark mode toggle: all colors switch correctly
- Hebrew locale: RTL layout, Hebrew text

### H4 — Boundary check

```bash
pnpm nx run-many -t lint --projects=web,ui,api,shared
```

No Nx boundary violations.

---

## Complexity Tracking

| Item                             | Why Needed                                       | Simpler Alternative Rejected Because                                              |
| -------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `libs/ui/tailwind.preset.ts`     | Design system must be self-contained             | Duplicating config in apps/web violates DRY and makes libs/ui unusable standalone |
| `libs/ui/styles/tokens.css`      | CSS variables must travel with the design system | Leaving in globals.css makes libs/ui dependent on consuming app                   |
| Phase sequencing (A→B→C→D→E→F→G) | Components depend on tokens existing             | Cannot migrate components before the token/preset system is in place              |

## Open Questions for Developer

1. **Framer Motion approved?** (`framer-motion` package) — required before Phase D starts. If no, Phase D/E use `tailwindcss-animate` CSS class alternatives.
2. **`apps/web/tailwind.config.js` → `.ts` rename?** — Research shows it's `.js`. Keep as `.js` unless developer prefers TypeScript.
3. **`(auth)` and `(main)` route groups** — Do these already exist in `apps/web/src/app/`? If so, Phase E slots in; if not, create route group directories.
