# Research: Home Page Infrastructure, Flow 2 & Flow 9

**Feature**: `001-home-infra-flow2-flow9`  
**Date**: 2026-04-11

## R-001 — Zustand + Clerk userId pattern

**Decision**: Store holds `userId: string | null`. `HomePage` calls `store.init({ getToken, userId })` in a `useEffect` seeded from `useAuth()`.

**Rationale**: Consistent with existing `useApiClient()` hook which injects `getToken` from `useAuth()` at the component layer, not in the store. `userId` is stable per Clerk session — stale-state risk is negligible.

**Alternatives considered**:
- Pass `userId` as param to every `submit()` — verbose, caller burden
- Store a `getAuth` getter closure — adds indirection without benefit for a stable value

## R-002 — Zustand and Zod versions

**Decision**: `zustand@^5`, `zod@^3` added to `apps/web`.

**Rationale**: Zustand 5 has full React 19 support. Zod 3 is the ecosystem standard; the FlowDefinition schema contract uses it. Neither conflicts with any existing dependency.

**Alternatives considered**: Jotai, Valibot — rejected (no ADR, no project precedent).

## R-003 — Illustration rename mapping

**Decision**: No SVG file renames. New TS export aliases added in `kebi-app-illustrations.tsx`:

| New canonical name | Maps to | Used by |
|---|---|---|
| `KebiIdleWelcoming` | `kebi-app-home-input.svg` | `HomeIdle`, `ConsultError` |
| `KebiExcited` | `kebi-app-success.svg` | `TasteProfileCelebration` |

**Rationale**: Renaming SVG files would break `/places` page and any future consumers. Renaming only TS exports achieves the spec goal (canonical names in code) without touching static assets.

## R-004 — i18n key restructure scope

**Decision**: Add `flow2.*` and `flow9.*` top-level namespaces. Retain `home.idle.*`. Remove keys exclusively consumed by deleted components.

**Keys added**: See plan.md Phase 1 Step 11 for full list.

**Keys removed**: `home.whereTo`, `home.moodPrompt`, `home.listening`, `home.tapToTalk`, `home.voicePrompt` — these were used only by `home-empty-state.tsx` (deleted).

## R-005 — ChatInput prop rename

**Decision**: Rename `onSend` → `onSubmit`. Remove internal `value` state. Wire to `store.submit()`.

**Rationale**: `home/page.tsx` is fully rewritten. The prop rename aligns with the spec's code snippet and makes the purpose unambiguous (submits to AI, not just sends text).

## R-006 — Dead component audit

Eight components confirmed dead after home page rewrite. See plan.md R-006 table for full list and rationale per file.

## R-007 — `submit()` animation-fetch race implementation

**Decision**: Two boolean flags (`animationComplete`, `fetchComplete`) in the store. `tryReveal()` is called by both `markAnimationComplete()` and the fetch `.then()` handler — it no-ops unless both flags are true.

**Rationale**: Simplest correct implementation. Avoids promises, observables, or channels. Both paths converge on the same synchronous flag check.

## R-008 — ConsultThinking setTimeout cleanup

**Decision**: Single `useEffect` with a `timeouts: ReturnType<typeof setTimeout>[]` array. Cleanup function calls `clearTimeout` on all. Prevents double-fire on React StrictMode double-invoke.

**Rationale**: Standard pattern for multi-step sequential animations. Cleanup prevents state updates on unmounted components.
