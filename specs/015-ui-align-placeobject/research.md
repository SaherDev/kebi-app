# Research: UI Alignment to PlaceObject Contract

All design decisions were locked in `docs/plans/2026-04-18-ui-align-placeobject.md` before this plan. No open unknowns remain. This document records the codebase inspection findings that confirmed or informed concrete implementation details.

---

## Finding 1: Shared types are already updated; old types are gone

**Decision**: Treat the store and component type errors as the primary driver of this feature, not schema mismatch.  
**Rationale**: `libs/shared/src/lib/types.ts` already exports `PlaceObject`, `ConsultResult`, `RecallResult`, `ExtractPlaceItem`, `ChipItem`, `SignalTier`, `UserContextResponse`. The old types (`RecallItem`, `SaveExtractPlace`, `ConsultPlace`, `ExtractPlaceData.places[]` as flat objects) are gone. The home store imports them → TypeScript errors today.  
**Alternatives considered**: Restoring old types as aliases. Rejected — that defeats the purpose of the alignment.

---

## Finding 2: FetchClient pattern for new API clients

**Decision**: New clients (`signal-client.ts`, `user-context-client.ts`) instantiate `FetchClient(apiBase, getToken)` directly, following the existing `chat-client.ts` pattern.  
**Rationale**: `FetchClient` at `apps/web/src/api/transports/fetch.transport.ts` handles auth headers, Capacitor base URL switching, and location attachment for POST. GET calls (`user-context`) use `FetchClient.get<T>`. POST calls (`signal`) use `FetchClient.post<T>`.  
**Note**: `FetchClient.post` automatically attaches `location` to every POST body. This is harmless for `/api/v1/signal` (NestJS ignores unknown fields per ADR-019).

---

## Finding 3: `provider_id` namespace prefix stripping

**Decision**: Strip the provider prefix (`"google:"`) before inserting `provider_id` as `query_place_id` in the Google Maps URL. Other namespace prefixes pass through as-is.  
**Rationale**: Google Maps `query_place_id` parameter expects a bare Google Place ID (e.g. `ChIJN1t_tDeuEmsRUsoyG83frY4`), not the namespaced form. The contract stores `"google:ChIJN1t_tDeuEmsRUsoyG83frY4"` — split on `:`, take `slice(1).join(':')`.  
**Implementation**: `place.provider_id.includes(':') ? place.provider_id.split(':').slice(1).join(':') : place.provider_id`

---

## Finding 4: `framer-motion` is already installed

**Decision**: No new package installs needed for PlaceCard animation.  
**Rationale**: `SaveSheet.tsx` and `RecallResults.tsx` already import from `framer-motion`. `motion`, `AnimatePresence`, `layout` prop are all available.

---

## Finding 5: `PlaceAvatar` is a reusable primitive

**Decision**: PlaceCard uses `PlaceAvatar` from `apps/web/src/components/PlaceAvatar.tsx` as the photo fallback.  
**Rationale**: The component already implements the warm Ghibli-palette `boring-avatars` seeded by place name. No new avatar component needed.

---

## Finding 6: `HomePhase` union location and home page switch

**Decision**: Add `'chip-selection'` to `HomePhase` in `flow-definition.ts:13`; add a matching case in `home/page.tsx:94` switch.  
**Rationale**: The phase switch at line 94 of `home/page.tsx` drives empty-state rendering. The `RESTING_PHASES` set at line 68 drives placeholder text logic — `'chip-selection'` must be added there too.

---

## Finding 7: Save auto-save rule change

**Decision**: Replace `confidence >= 0.7 && status !== 'unresolved'` with `status === 'saved'` as the auto-save signal.  
**Rationale**: The AI service now stamps `status: 'saved'` directly when it decided to save. Confidence threshold enforcement moved to kebi. The `SaveSheet` mount effect auto-saves items where `status === 'saved'`; no other items are auto-saved.

---

## Finding 8: Recall `total_count` vs `total` / `has_more` vs `empty_state`

**Decision**: Replace `data.total` + `data.has_more` with `data.total_count` + `data.empty_state` everywhere (store, RecallResults, RecallResultBubble).  
**Rationale**: The new `RecallResponseData` in `libs/shared` uses `total_count` and `empty_state`. The old fields (`total`, `has_more`) are gone.

---

## Finding 9: `submit()` signal_tier forwarding

**Decision**: Pass `signalTier` from store to `client.chat()` as an optional `signalTier` field on `ChatClientOptions`. Real client includes it in the POST body as `signal_tier`. Fixture client ignores it.  
**Rationale**: `chat-client.ts` is the single injection point for all chat HTTP calls (ADR-029 transport pattern). Adding it here ensures every path (consult, recall, save, assistant) forwards the tier without per-flow changes.

---

## Finding 10: `loadUserContext()` call site

**Decision**: Call `loadUserContext()` from within `init()` (not from the React `useEffect` in `home/page.tsx`).  
**Rationale**: `init()` already receives `userId` and `getToken` which `loadUserContext()` needs. Calling it inside `init()` guarantees it fires once on mount without requiring a separate `useEffect` in the page. The page's existing `useEffect` already calls `store.init(...)`.
