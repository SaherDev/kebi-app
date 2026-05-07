# Research: Migrate Lovable Design Output

**Date**: 2026-03-12 | **Branch**: `001-migrate-lovable-design`

---

## 1. Current State of `libs/ui`

**Decision**: Minimal — only `Button` + `cn()` exist today. Must be expanded significantly.

**Findings**:
- `libs/ui/src/lib/button.tsx` — 4 variants (default, muted, outline, ghost), 4 sizes. Lovable's Button has more (hero, xl, secondary, destructive, link). Lovable's version supersedes.
- `libs/ui/src/lib/utils.ts` — `cn()` with clsx + tailwind-merge. Keep as-is.
- `libs/ui/src/index.ts` — exports both. Will need expansion.
- No `tailwind.config.ts` in `libs/ui` — must be created as `tailwind.preset.ts`.

**Rationale**: Lovable's components are more complete. Replace the existing Button with the Lovable version. All new components are net-new additions.

---

## 2. `apps/web` Tailwind Config — Current State

**Decision**: Merge via preset, don't replace.

**Findings**:
- File is `tailwind.config.js` (not .ts — do not rename)
- `darkMode: 'class'` — already set correctly
- `tailwindcss-animate` — **already installed** (v1.0.0 in apps/web). No approval flag needed.
- Existing semantic tokens: background, foreground, primary, muted, accent, destructive, border, ring, radius
- Content paths: `./src/**/*.{ts,tsx}` + `../../libs/ui/src/**/*.{ts,tsx}` — correct for monorepo
- Missing: fontFamily, extended colors (forest, gold, cream, warm-white, surface, sidebar), full borderRadius scale, boxShadow (kebi-app-sm/md/lg/glow), keyframes, animations

**Rationale**: Existing tokens must be preserved (monorepo's shadcn base). New tokens from Lovable are additive via the preset.

---

## 3. `globals.css` — Current State

**Decision**: Keep existing variables, add Lovable's extended set.

**Findings**:
- 14 CSS variables currently (light + dark): background, foreground, primary, muted, accent, destructive, border, ring, radius
- Lovable's `index.css` has many more: sidebar tokens, shadow tokens (--shadow-sm/md/lg/glow), font variables, surface, text levels (primary/secondary/tertiary), forest, cream, warm-white, gold
- Lovable's primary color differs (warm cream/brown vs monorepo's purple) — **Lovable wins** as design intent source
- Lovable also has `@layer utilities` with `.shadow-kebi-app-*` and `.font-display`/`.font-body` classes
- Lovable has `src/styles/animations.css` with organic keyframes — must be merged too

**Rationale**: CSS variables move to `libs/ui/styles/tokens.css`. The `globals.css` becomes the import point + Tailwind directives only.

---

## 4. Lovable Component Inventory

**Decision**: Selective migration — only migrate components used by target screens. Full shadcn/ui library (48 files) is not needed wholesale.

### `src/components/ui/` — shadcn/ui primitives → `libs/ui/src/components/`
Migrate only what target screens actually use:
- `button.tsx` — used everywhere
- `badge.tsx` — used in PlaceCard, result views
- `avatar.tsx` — used in NavBar, ProfileMenu
- `card.tsx` — used in KebiCard, PlaceCard
- `input.tsx` — used in ChatInput
- `dialog.tsx` — used in Modal
- `scroll-area.tsx` — used in HomeScreen
- `separator.tsx` — used in ProfileMenu
- `skeleton.tsx` — used in LoadingState
- `tabs.tsx` — used in ProfileMenu/settings
- `tooltip.tsx` — used in NavBar
- `dropdown-menu.tsx` — used in ProfileMenu

Do NOT migrate the other ~36 components (calendar, carousel, chart, data-table, etc.) — not used in target screens. Add on demand.

### `src/components/` root → `apps/web/src/components/`
All 14 Kebi-specific components:
- AgentResponseBubble, AgentStep, ChatInput, ChatMessage, EmptyState
- LanguageSwitcher, LoadingState, Modal, NavBar, NavLink
- PlaceCard, ProfileMenu, ReasoningBlock, Tag, ThemeToggle
- KebiAvatar, KebiCard
- + SplashScreen (new, with localStorage logic)

### `src/components/illustrations/KebiIllustrations.tsx`
Migrate as React component to `apps/web/src/components/illustrations/kebi-app-illustrations.tsx`. Keep as component (not static assets) — these are animated SVG wrappers.

---

## 5. Framer Motion — Dependency Flag

**Decision**: **Flag for approval before implementation.** Used in all 3 screens for entrance animations.

**Findings**:
- All 3 screens (SplashScreen, AuthScreen, HomeScreen) use `framer-motion` for `motion.div`, `AnimatePresence`, and staggered entrance animations.
- `framer-motion` is NOT in the monorepo's `package.json`.
- **Alternative if not approved**: CSS animations via `tailwindcss-animate` keyframes (already installed). The fade-in, slide-up, breathe animations are already defined as Tailwind animation utilities.
- Recommendation: Approve framer-motion. It's a standard Next.js animation library and the screens rely on it for UX quality.

---

## 6. i18n Conversion: react-i18next → next-intl

**Decision**: JSON structure is compatible. Conversion is config-only, not content.

**Findings**:
- Lovable uses `react-i18next` with path-based language detection (`/en/`, `/he/`)
- Monorepo uses `next-intl` with URL routing (`/en/`, `/he/`) — same URL pattern
- Key structure in en.json/he.json is flat-nested JSON — exactly what next-intl expects
- `src/i18n/index.ts` (i18next config) is NOT migrated — discard it
- Usage conversion: `useTranslation('ns')` → `useTranslations('ns')`, `t('key')` → `t('key')` (same API shape)
- `src/i18n/en.json` has 101 lines of complete translations across 10 namespaces
- Current `messages/en.json` is empty (stub) — Lovable's content overwrites it entirely

---

## 7. Assets

**Decision**: Static SVGs → `apps/web/public/illustrations/`. React wrappers stay as components.

**Findings**:
- 19 SVG files in `src/assets/` — all Kebi illustrations
- `KebiIllustrations.tsx` wraps these as React components with responsive sizing
- In Next.js: SVGs in `public/` are served at `/illustrations/kebi-app-auth.svg` etc.
- `KebiIllustrations.tsx` will use `<img src="/illustrations/kebi-app-auth.svg">` or Next.js `<Image>` — prefer `next/image` for optimization

---

## 8. SplashScreen localStorage Strategy

**Decision**: Key `kebi-app-splash-seen` in localStorage. Check on mount, set on dismiss.

**Findings**:
- Current SplashScreen navigates to `/auth` on click — no persistence
- Next.js approach: root layout checks localStorage on client mount, conditionally renders `<SplashScreen />`
- Must use `'use client'` in the component
- Use `useEffect` to check flag after hydration (avoids SSR mismatch)

---

## 9. `next/font/google` Integration

**Decision**: Fonts declared in `apps/web/src/app/layout.tsx`, CSS variables passed to body.

**Pattern**:
```tsx
const dmSerif = DM_Serif_Display({ subsets: ['latin'], variable: '--font-display', weight: '400' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body' })
// Apply both variables to <body>
```
The Tailwind preset then references `var(--font-display)` and `var(--font-body)` in fontFamily config.

---

## 10. Existing `libs/ui/tailwind.config.js`

**Findings**: No `tailwind.config` exists in `libs/ui` at all. The new `tailwind.preset.ts` is a net-new file. `apps/web/tailwind.config.js` will import and use it via `presets: [require('../../libs/ui/tailwind.preset')]` or via the workspace package.

---

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| libs/ui current state | Minimal — Button + cn() only. Expand with Lovable components |
| tailwindcss-animate | Already installed — no flag needed |
| Framer Motion | Flag for approval — used in all screens |
| i18n conversion | JSON content compatible; config-only swap |
| SVG assets | Static files → public/illustrations/; React wrappers stay as components |
| Component scope | Selective: 12 shadcn primitives, all 14 Kebi-specific, not full shadcn library |
| Lovable primary color | Overwrites monorepo's purple — warm brown/cream is design intent |
| SplashScreen persistence | localStorage key `kebi-app-splash-seen` |
| Font loading | next/font/google, CSS variables on body |
| tailwind.config filename | Keep as .js (not .ts) — do not rename |
