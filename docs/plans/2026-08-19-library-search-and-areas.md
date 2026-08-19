# Library: search + area sections (Tasks A & B)

kebi shipped ADR-164 (`q`, `filtered_total`) and ADR-165 (`area` handle,
`GET /v1/user/library/areas`, `?area=` prefix filter). This wires both through
the NestJS gateway to the mobile app.

Design: `docs/kebi-app-design-system/kebi-library-filter-options.html`
(§1 option A, §4 area sections, §5 header v1).

## Task A — search is the only control

**Goal:** Library's only control is search, and it searches the whole library.

- Delete `library-sort-sheet.tsx`, `library-filter-sheet.tsx`, `library-toolbar.tsx`
- `q` becomes a server param; delete the client-side `matchesQuery` filter
- `filtered_total` renders as `3 of 84`, only while a query is active
- Sort and status filtering are gone from the screen (params stay in the contract)

## Task B — saves group by area

**Goal:** at rest, saves group by area; every header opens the area screen.

- `GET /v1/user/library/areas` → groups ordered by `count` desc
- Rollup rule: group by most-specific key, but if a city has rows that resolve
  only to city level, roll that whole city into one group (sum entries sharing
  the `parent`, open with `?area=<parent-key>`)
- `FlatList` → `SectionList`; header v1 (bare, hairline, whole row taps)
- Header tap → `area.uri` via the existing chat-entity link handler
- Per-group rows fetched with `?area=<key>`, lazily
- `elsewhere` bucket = `total − Σ counts`; not tappable
- While searching: sections step aside, flat list

## Files

**libs/shared** — `types.ts`: `AreaHandle`, `LibraryAreasResponse`; `area` on
`PlaceView`; `filtered_total` on `LibraryResponse`.

**services/api** — `dto/library-query.dto.ts` (+`q`, +`area`),
`user.service.ts` (+`getLibraryAreas`), `user.controller.ts` (+route), specs.

**apps/mobile** — `api/models/library.ts`, `api/routes.ts`, `api/library.ts`,
`components/use-library.ts`, `app/library.tsx`, new
`components/library-area-header.tsx`, new `lib/library-groups.ts` (pure
grouping + rollup, unit-tested), `i18n/en.json`.

## Verify

`pnpm nx affected -t test,lint` plus `tsc --noEmit -p apps/mobile/tsconfig.app.json`
(the mobile `typecheck` target is unreliable — see memory).
