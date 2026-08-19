# Handoff: what the Library screen needs from kebi

The mobile Library screen (`apps/mobile/src/app/library.tsx`) is being rebuilt
around search and area sections. Most of that work is client-side and already
unblocked. This doc is the short list of what it needs from the kebi backend,
and — just as importantly — what it **no longer** needs, because an earlier
proposal from the backend side asked for more than the design turned out to
require.

Design reference: `docs/kebi-app-design-system/kebi-library-filter-options.html`
(§1 option A locked, §4 area sections, §5 header v1 locked).
Related: kebi ADR-153 (area screen), ADR-151 (place screen personal half).

## Goal

The Library screen has one job: help you pick something you already saved.
Two controls, no more.

1. **Search is the filter.** One field, top bar. Typing does what a row of
   filter chips would have done, and it is the only control that scales from
   20 saves to 500.
2. **At rest, saves group by area.** Each group header is a **link**, not a
   filter — tapping `canggu` opens the area screen that already ships, with
   its profile, your saves there, and the neighbourhoods under it.

Everything else is deleted: the sort sheet (recent ↔ A–Z), the filter sheet
(all / visited / not visited / approved / needs review), and the toolbar row
that opened them. They went unused, and the sheets cost three taps and two
animations each to reach a single-select chip row.

## What ships without you

So it's clear what is and isn't blocked — none of this needs backend work:

- Deleting both sheets and the toolbar row.
- Grouping rows into sections and rendering per-group counts. Counts are group
  lengths, so they're exact, and a section only exists if it has rows.
- The `3 of 84` filtered count during search.
- Paging the whole library in on the first keystroke so search covers
  everything rather than the loaded page (see gap 2 — this is a workaround).

## The gaps

### 1. An area handle on library rows — the one true blocker

`GET /v1/user/library` rows carry location as **display strings only**:

```ts
// apps/mobile/src/api/models/place-core.ts
location: { lat, lng, address, neighborhood, city, country } | null
```

There is no area key and no `uri`, so the client can *group* by `city` today
but cannot make a header *tappable*. Everything else in §4 of the mockup works
without you; this is what stops the design being the design.

**Ask:** an area handle per row, shaped like the ones already in the contract
(`ChatEntity`, `AreaBreadcrumbItem`):

```ts
location.area: {
  key:  string;        // raw geo key, e.g. "id/bali/canggu"
  name: string;        // display name, e.g. "Canggu"
  uri:  string;        // kebi://area/{encoded} — opaque, handed to the link handler
  icon: string | null; // area row icon (ADR-146), null falls back client-side
} | null
```

`uri` must be the pre-composed link, not something we rebuild from `key` —
`types.ts:136` is explicit that an area's URI segment is the geo key run
through kebi's codec, so the client must never construct it.

**One thing to settle together: granularity.** Canggu is a *neighbourhood*
under `indonesia › bali`, not a city. If `area` resolves to the most specific
profiled area, groups may fragment (a library of scattered saves becomes many
one-row sections). If it resolves to city level, Bali saves collapse into one
`badung`-ish group and lose the name people actually use. Our instinct is
**most-specific-profiled, with the parent available** so the client can roll up
if groups get too small:

```ts
location.area_parent: { key, name, uri } | null   // "bali"
```

Happy to be talked out of this — you know what the areas table actually
contains. It's the only open design question in the ask.

### 2. `q` — server-side search

Search currently filters client-side over whatever keyset pages are loaded.
On a large library that means the screen says *"no results"* for a place that
exists three pages down. We are shipping a workaround: on the first keystroke,
loop `loadMore()` until `next_cursor === null`, then filter the full set. At
`LIBRARY_PAGE_LIMIT = 50` that's 2 requests for 84 saves and 10 for 500 —
tolerable now, not tolerable later.

**Ask:** `q` as a query param on `GET /v1/user/library`, matched against place
name and aliases, neighbourhood/city, tags, and categories (roughly what the
client matches today, in `library.tsx:matchesQuery`). Sort-bound cursor
semantics unchanged.

This also retires the paging loop, which is worth saying plainly: the loop is
the riskiest thing we're building, because `use-library.ts` race-guards reads
with a monotonic `reqId` and a loop that fights that guard silently yields a
partial library — the exact bug being fixed, wearing a new hat. `q` makes it
all go away.

### 3. "You're here" — parked, not requested

Pinning the user's current area to the top of the list needs device
coordinates resolved to an area key. `getDeviceCity()`
(`apps/mobile/src/lib/location.ts:61`) returns `district ?? subregion ?? city`
— a display string, not a key, so it can't be matched against `area.key`
reliably. **We are not asking for this.** Groups will order by size or by
most-recent-save instead. Raising it only so it isn't rediscovered later.

## What we are NOT asking for

An earlier note from the backend side proposed facet counts and a chip rail
(`not been yet` / `liked` / `nearby`) as the top priority. That design was
considered and **dropped**, so please don't build for it:

| Proposed | Status |
|---|---|
| Facet counts on the library response | **Not needed.** Group counts come free from client-side grouping, and they're exact. |
| `liked` filter param | **Not needed.** No chip rail to hang it on. |
| Nearby / distance param | **Not needed** for Library. |
| Area-key normalization | **Already done** — see below. |
| `q` free-text search | **Yes** — gap 2. Still the right call. |
| Filtered count ("12 of 84") | **Yes**, but client-side. No API change. |
| Cut `name` sort | **Done** client-side; the whole sort control is gone. |

The reasoning: a chip rail needs server facets to suppress zero-result chips,
because a chip that empties an 84-place library reads as a bug. Area sections
get the same "one tap, always visible, never empty" result out of data already
on the row — a section exists *because* it has rows. The chips became
redundant rather than blocked.

## A correction from our side

Our earlier read repeated the concern that "Canggu saves file under Badung",
and treated area-key normalization as outstanding work. **That was wrong.**
kebi's geo keys are already hierarchical (`{cc}/{city}/{neighborhood}`), and
`libs/shared/src/lib/types.ts:356` uses "`indonesia › bali` above the Canggu
header" as its own worked example. The normalization exists. What's missing is
only that library rows don't *carry* the resulting handle — gap 1.

## Acceptance

- [ ] `GET /v1/user/library` rows carry `location.area` (and `area_parent`),
      `uri` pre-composed, `null` where a place has no profiled area.
- [ ] Tapping a Library section header opens the same area screen a chat area
      link opens, for the same key — no second code path.
- [ ] Rows with `location.area === null` are groupable into a client-side
      `elsewhere` bucket, which is deliberately not tappable.
- [ ] `q` returns matches from the whole library, not a page; the client drops
      the paging loop when it lands.
