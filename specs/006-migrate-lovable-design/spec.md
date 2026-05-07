# Feature Specification: Migrate Lovable Design Output into Kebi Nx Monorepo

**Feature Branch**: `001-migrate-lovable-design`
**Created**: 2026-03-12
**Status**: Draft
**Input**: User description: "Migrate Lovable-generated Vite + React app (kebi-app-guide-bot) design output — components, screens, styles, i18n, and assets — into the Kebi Nx monorepo (apps/web) as proper Next.js App Router pages and shared UI components."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Opens App and Sees Styled UI (Priority: P1)

A developer running the local dev server sees the migrated design rendered correctly: the home screen, the auth (login) screen, and the splash screen all render with correct colors, typography, spacing, and component variants as defined in the Lovable design system.

**Why this priority**: This is the core deliverable. Everything else (tokens, styles, components) only has value if it produces a correctly rendered UI matching design intent.

**Independent Test**: Start the dev server, visit the home, login, and splash routes — the pages render visually matching the DesignSystemScreen reference with no broken styles, missing fonts, or layout regressions.

**Acceptance Scenarios**:

1. **Given** the dev server is running, **When** a developer visits the home page route, **Then** the HomeScreen renders with correct layout, color palette, typography (DM Serif Display headings, DM Sans body), and component variants.
2. **Given** the dev server is running, **When** a developer visits the login route, **Then** the AuthScreen renders with correct form layout, button styles, and branding illustration.
3. **Given** the developer toggles dark mode, **When** viewing any migrated screen, **Then** all colors switch to the dark theme variable set with no raw color values visible.
4. **Given** the locale is set to Hebrew, **When** viewing any migrated screen, **Then** the layout mirrors correctly (RTL) and all text displays in Hebrew.

---

### User Story 2 - Designer Reviews Component Library (Priority: P2)

A designer or developer reviews the migrated components and verifies each component's variants, sizes, and states match the DesignSystemScreen visual reference. Generic UI primitives live in the shared design system (`libs/ui`); Kebi-specific components live in the app layer (`apps/web/src/components`).

**Why this priority**: Components are reused across all screens. Correctness here prevents rework on every consumer.

**Independent Test**: Each component can be rendered in isolation with its documented variants; visual output matches DesignSystemScreen for that component.

**Acceptance Scenarios**:

1. **Given** a component is rendered with each of its defined variants, **When** compared to the DesignSystemScreen reference, **Then** colors, spacing, border-radius, and typography match exactly.
2. **Given** a component accepts a `className` prop, **When** additional classes are passed, **Then** they merge correctly without overriding base variant styles.
3. **Given** a component has interactive states (hover, focus, disabled), **When** those states are triggered, **Then** the visual feedback matches the design intent from DesignSystemScreen.

---

### User Story 3 - Developer Accesses Design Tokens Programmatically (Priority: P3)

A developer imports typed design tokens from `tokens.ts` to use token values in logic (e.g., dynamic styles, charting libraries, test assertions) without parsing CSS variable strings.

**Why this priority**: Typed tokens prevent future hardcoding. Secondary to the visual output but important for long-term maintainability.

**Independent Test**: Import a token from `tokens.ts` in a TypeScript file — the type checker accepts it and the value matches the corresponding CSS variable in `globals.css`.

**Acceptance Scenarios**:

1. **Given** `tokens.ts` is imported, **When** a developer accesses `tokens.colors.primary`, **Then** the value matches the `--primary` CSS variable defined in `globals.css`.
2. **Given** the TypeScript compiler runs on `tokens.ts`, **Then** no type errors are reported and all token values are typed (no `any`).

---

### Edge Cases

- What happens if a Lovable component uses a dependency not installed in the monorepo?
- How does the system handle SVG files that contain inline styles instead of class-based styling?
- What if a Lovable translation key conflicts with an existing key in `apps/web/messages/en.json`?
- What happens if a component uses a React Router navigation pattern that has no direct Next.js equivalent?
- What if the Lovable `tailwind.config.ts` defines a color that conflicts with an existing token in the monorepo's Tailwind config?

## Requirements *(mandatory)*

### Functional Requirements

**Component placement:**

- **FR-001**: Generic UI primitives from Lovable's `src/components/ui/` (Badge, Modal, NavBar, NavLink, Tag, ThemeToggle, and any other app-agnostic primitives) MUST be migrated to `libs/ui/src/components/` and exported via `libs/ui`'s `index.ts`, importable as `@kebi-app/ui`.
- **FR-002**: Kebi-specific components from Lovable's `src/components/` root (AgentResponseBubble, AgentStep, ChatInput, ChatMessage, EmptyState, LanguageSwitcher, LoadingState, PlaceCard, ProfileMenu, ReasoningBlock, KebiAvatar, KebiCard) MUST be migrated to `apps/web/src/components/`.
- **FR-003**: Any component not clearly fitting either category MUST be flagged to the developer before migrating.

**Screens:**

- **FR-004**: AuthScreen MUST be accessible at `apps/web/src/app/(auth)/login/page.tsx`.
- **FR-005**: HomeScreen MUST be accessible at `apps/web/src/app/(main)/page.tsx`.
- **FR-006**: SplashScreen MUST be implemented as a standalone client component at `apps/web/src/components/splash-screen.tsx`, imported and controlled by the root layout or home page — shown on first visit only (tracked via a `localStorage` flag), dismissed after animation completes, and never shown again on subsequent visits.

**Styles and tokens:**

- **FR-007**: `libs/ui` MUST export a Tailwind preset at `libs/ui/tailwind.preset.ts` containing all custom theme extensions: `fontFamily` (DM Serif Display, DM Sans), extended color palette (forest, gold, cream, warm-white, surface, sidebar), `borderRadius` scale, `boxShadow` (kebi-app-sm/md/lg/glow), `keyframes`, and `animation` entries.
- **FR-008**: `apps/web/tailwind.config.ts` MUST consume the `libs/ui` preset via `presets: [preset]` instead of duplicating theme values. App-specific overrides only.
- **FR-009**: `libs/ui` MUST export a CSS stylesheet (e.g., `libs/ui/styles/tokens.css`) containing all CSS custom properties for both light (`[data-theme="light"]`/`:root`) and dark (`.dark`/`[data-theme="dark"]`) themes. This makes the design system self-contained.
- **FR-010**: `apps/web/src/app/globals.css` MUST import `libs/ui`'s token stylesheet and add only app-specific CSS on top. No duplication of variable definitions.
- **FR-011**: A typed `tokens.ts` file MUST be created at `apps/web/src/styles/tokens.ts` exporting all design token values (colors, spacing, radii, shadows, typography) for programmatic access, consistent with the CSS variables defined in `libs/ui/styles/tokens.css`.

**i18n:**

- **FR-012**: The `messages/` directory MUST be moved from the repo root to `apps/web/messages/`.
- **FR-013**: The next-intl config MUST be updated to read translations from `apps/web/messages/`.
- **FR-014**: Lovable translation content MUST be merged into `apps/web/messages/en.json` and `apps/web/messages/he.json`. On key conflicts, Lovable's value wins — existing values are overwritten.

**Assets:**

- **FR-015**: SVG illustrations from Lovable's `src/assets/` MUST be placed in `apps/web/public/illustrations/`.
- **FR-016**: Other static assets MUST be placed in `apps/web/public/`.

**Code quality:**

- **FR-017**: Every component using browser APIs, event handlers, or state MUST include the client-side rendering directive.
- **FR-018**: All React Router imports MUST be replaced with Next.js navigation equivalents.
- **FR-019**: All Vite-specific environment variable references MUST be replaced with the Next.js public env pattern.
- **FR-020**: Every migrated component MUST have proper TypeScript types — no `any`.
- **FR-021**: The migrated codebase MUST pass lint and build in `apps/web` with zero errors.

**Approval gates:**

- **FR-022**: Any Lovable dependency not already installed in the monorepo MUST be flagged and approved before installation.
- **FR-023**: `tailwindcss-animate` MUST be flagged for approval before adding as a dependency.

### Key Entities

- **Design Token**: A named, typed value (color, spacing, radius, shadow, font) that maps to a CSS custom property. Defined once in `libs/ui/styles/tokens.css`, mapped to Tailwind classes via `libs/ui/tailwind.preset.ts`, and exported as typed values in `apps/web/src/styles/tokens.ts`.
- **Generic UI Component**: A reusable, app-agnostic primitive (Badge, Modal, NavBar, etc.) that lives in `libs/ui` and is consumed via `@kebi-app/ui`.
- **Kebi-Specific Component**: A component encoding Kebi product logic or visual identity (PlaceCard, AgentStep, ReasoningBlock, etc.) that lives in `apps/web/src/components`.
- **Screen / Page**: A Next.js App Router page component mapping to a URL route, composed from both generic and Kebi-specific components.
- **Theme Variable Set**: The collection of CSS custom properties defining the visual appearance for light or dark mode.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 3 migrated screens (login, home, splash) render without visual errors in both light and dark mode.
- **SC-002**: All migrated components render with correct variant styles matching the DesignSystemScreen reference — zero hardcoded color values, all colors use semantic tokens.
- **SC-003**: The app passes lint and build in `apps/web` with zero errors and zero warnings related to migrated files.
- **SC-004**: Both English and Hebrew locales display correct translations with correct RTL layout on all migrated screens.
- **SC-005**: Every design token exported from `apps/web/src/styles/tokens.ts` matches its corresponding CSS custom property in `libs/ui/styles/tokens.css` — no mismatches.
- **SC-006**: Zero new packages are installed without explicit developer approval.
- **SC-007**: Generic UI components are importable via `@kebi-app/ui`; Kebi-specific components are importable from `apps/web/src/components/` — no Nx boundary violations.

## Clarifications

### Session 2026-03-12

- Q: How is "first visit" detected for the SplashScreen? → A: `localStorage` flag — shown once ever per browser, never again after first dismissal.
- Q: How are fonts (DM Serif Display, DM Sans) loaded? → A: `next/font/google` — self-hosted by Next.js, no external CDN.
- Q: On translation key conflict during merge, which value wins? → A: Lovable's value overwrites the existing monorepo value.

## Assumptions

- The Lovable source repo is accessible at `~/dev/others-repos/kebi-app-guide-bot/`.
- The Lovable i18n format is JSON-based; content is usable but key structure may need adjustment for next-intl conventions.
- `tailwindcss-animate` is not yet installed in the monorepo and will be flagged for approval before use.
- The Lovable components were built with Tailwind; no CSS Modules or styled-components are expected.
- DesignSystemScreen.tsx is the canonical visual reference; any discrepancy between it and a component file is resolved in favor of DesignSystemScreen.
- Fonts (DM Serif Display, DM Sans) are loaded via `next/font/google` — self-hosted by Next.js, zero layout shift, no external CDN dependency at runtime.
- The illustrations subfolder (`src/components/illustrations/`) contains SVG components that will be converted to static assets in `apps/web/public/illustrations/`.
- **The `src/components/ui/` components are NOT pure shadcn primitives.** They use Kebi-specific Tailwind classes (`font-body`, `shadow-kebi-app-sm/md/lg`, `bg-sidebar`, `text-sidebar-foreground`, etc.) that depend on the custom preset and CSS variables. The `libs/ui` preset and token stylesheet MUST be in place before any component migration begins.
- **`libs/ui` is the design system owner.** It ships the Tailwind preset (`tailwind.preset.ts`) and CSS variable stylesheet (`styles/tokens.css`). Apps consume both — they do not duplicate or define token values themselves.
