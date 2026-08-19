# Reply: what kebi will ship for the Library screen

Answer to `library-areas-handoff.md`. Both gaps are accepted. They ship as **two
separate tasks**, in this order:

- **Task A — search.** `q` + `filtered_total` on `GET /v1/user/library`. No client
  field change, no area machinery; deletes your search paging loop on landing.
- **Task B — areas.** A stored geo key, the per-row `area` handle, the area
  distribution, `sort=area`, and an `?area=` filter.

Splitting them means you get search early rather than waiting on the area work,
which is the larger of the two.

Three things change from your doc, one thing in it is factually wrong, and one
item you listed as *ships without you* actually doesn't.

---

## Task A: search

### `q` and `filtered_total` on `GET /v1/user/library`

`q` matches, case-insensitively and on substrings (so it works mid-typing —
"cang" finds Canggu): place name, name aliases, city, neighbourhood, tags,
categories. AND-ed with any other filters. It is a **predicate, not a relevance
ranking**, which is what keeps your sort-bound cursor semantics untouched.

`filtered_total` is added to the response: the count of rows matching `q` +
filters, whole library. `total` keeps its current meaning — the unfiltered grand
total. With no `q` and no filters the two are equal.

Note this is why `filtered_total` is ours and not yours. Your doc files the
`3 of 84` count as *client-side, no API change* — true only while search is
client-side. Once we own `q`, you can't count matches you never received.

---

## Task B: areas

### 1. `area` on the row — top level, not under `location`

```ts
area: {
  key:    string;   // "id/bali/canggu"
  name:   string;   // "Canggu"
  uri:    string;   // "kebi://area/{token}" — pre-composed, never rebuilt client-side
  icon:   string | null;
  parent: { key: string; name: string; uri: string } | null;  // "id/bali" / "Bali"
} | null
```

**This is a sibling of `place` / `user_data` / `claims`, not `place.location.area`.**
That's the one shape change we're asking of you, and the reason is on our side:
`LocationContext` is a domain model that is also a *query input*, so hanging a
`kebi://` URI and an areas-table icon inside it fuses wire shape to persistence
shape — the coupling ADR-105 exists to prevent. Same field, same contents, one
path change in your mapper.

Present on Library rows **and** on `GET /v1/places/{id}`, since it's the same DTO.

### 2. `GET /v1/user/library/areas` — the area distribution

Every area the caller has saves in. Complete, not paged, not truncated.

```ts
{ areas: Array<{
    key: string; name: string; uri: string; icon: string | null;
    parent: { key: string; name: string; uri: string } | null;
    count: number;                     // exact, whole library
  }> }
```

**Order is not part of the contract** — sort it however the screen wants. We're
deliberately not returning sections: no ordering opinion, no rollup, no pinning,
no truncation. Which areas a user's saves fall into is a fact about their data;
how to lay them out is yours. Same builder produces this and the per-row handle,
so a row's area name and a header's area name cannot disagree.

**This distribution is always unfiltered** — it ignores `q` and every filter. It's
the at-rest navigation index, and if it narrowed while someone typed, the section
list would shift underneath them. The consequence needs naming on your side:
during an active search, counts here and visible rows will disagree, so search
should replace the sections with a flat result list plus `filtered_total` rather
than render sections with at-rest counts.

### 3. `?area=<key>` — and `sort=area` is **not** being built

`?area=<key>` returns only the saves under that key, with **prefix** semantics:
`id/bali` returns everything in Bali including its neighbourhoods, `id/bali/canggu`
just Canggu. Combines with `q`, so searching within an area narrows rather than
resets. A malformed key is a 422 — deliberately loud, because a typo'd key
matching nothing is indistinguishable from "you have no saves here".

**We dropped `sort=area`.** Reply 2 said you'd order groups by count and pull
each group's rows with `?area=` as they scroll in, so `sort=area` "may go
unused" — and it was the expensive half: grouping by key while ordering by
recency *inside* each group is a mixed-direction keyset that has to be
hand-expanded, for a control nobody would call. `?area=` gets you the same rows
with none of that. Say so if your plan changes and we'll build it properly.

Between `q` and `?area=`, **you can delete both paging loops** — the search one
and the grouping one.

### 4. `area` is on the place screen too

`GET /v1/places/{id}` carries the same `area` field, so a place opened from chat
knows its area exactly as a library row does. Same builder, same shape.

---

## The correction: your group counts are not exact

Your doc lists under *What ships without you*:

> Counts are group lengths, so they're exact, and a section only exists if it has rows.

That holds only once the whole library is loaded. Against a keyset page it's the
same defect you correctly rejected for search — on page 1 of 3, `Canggu (4)` means
*4 so far*, and a city that first appears on page 3 has no section yet. Worse than
the search case, because it happens on first paint rather than first keystroke.

You can't count what we haven't sent, so this is ours: hence the distribution
endpoint for counts, and `sort=area` / `?area=` so the rows themselves arrive in a
usable order. Without the latter two, sections would mean permanently loading the
entire library — a workaround worse than the one you're already uneasy about.

We know the distribution looks like the facet counts you rejected. It isn't a
facet layer — it's one aggregate, for grouping you're already building, because
the client-side version is wrong.

## What's wrong in your doc

Acceptance criterion 1 says `area` is null "where a place has no profiled area."
Profiling is not the condition. `GET /v1/areas/{id}` renders **any** valid geo key
— an unprofiled one returns a thin screen and dispatches the profiler — so a
header is tappable whether or not a profile row exists.

`area` is null only when the key would be **coarser than a city**, i.e. the place
has no country code or no city. So `elsewhere` is a *data completeness* bucket,
not an unprofiled bucket.

**Warning for your testing:** country code is nullable on older place rows and
self-heals on re-fetch, and the ADR-163 migration and backfill have not run on
production yet. `elsewhere` will look inflated until they do, and our own
re-derivation cannot fix it — a key can't be computed from a country code that
isn't there. If it looks broken, that's the cause, not the contract. We're
measuring the real size separately.

Second, smaller: area names come from the profile row when one exists, and are
derived from the key slug when it doesn't (`kuta-utara` → "Kuta Utara"). Since
area rows are created lazily on first open, most names will be slug-derived at
first — correct and readable, occasionally plainer than the profiler would write,
and self-correcting as areas get opened.

## Confirmed, no change needed

- **Granularity: your instinct is right.** Most-specific with the parent available
  is what we'll send, and your worked example is literally what the mapper
  produces — `id/bali/canggu`, parent `id/bali`. ADR-163 demoted
  `administrative_area_level_2` ("Kabupaten Badung") to a last-resort
  *neighbourhood*, and city falls back to `administrative_area_level_1`, which is
  Bali. Badung cannot surface as a group name.
- **Your self-correction is also right** — the normalization exists; only the
  handle was missing.
- One thing you didn't flag: group by `key`, never by `name`. Neighbourhood names
  repeat across countries.

The gap worth knowing about: `neighborhood` is nullable, so most-specific yields a
*city-level* key for some rows in a city where others resolve deeper. You'll see
`Thonglor`, `Ari`, and a sibling `Bangkok` that means "Bangkok, unspecified". That
reads worse than a one-row section. `parent` is what lets you roll those up — it's
the reason we're sending it, not just an escape hatch.

## Not building

- **Facet counts** — your argument won; a section exists because it has rows.
- **Chip-rail params.** `liked` / `visited` already exist as params if you ever
  want them. `nearby` we're not doing: distance ordering needs the cursor to carry
  the origin or paging re-anchors when the device moves. Ask if you want it and
  we'll scope it properly.
- **Removing the params you dropped.** `sort=name` and the filter set stay in the
  contract — unused optional params cost nothing, and that filter model is shared
  with the agent's own retrieval, so it isn't the Library screen's to retire.

## Your §3, "you're here" — parked on our side of the line

You shelved it because `getDeviceCity()` returns a display string that can't be
matched to `area.key`. Resolving coordinates to an area key is something this repo
already does for chat turns, so this is a solvable backend request rather than a
permanent wall. Not scoped now — but don't design around its absence forever.

## Acceptance

**Task A**

- [ ] `q` returns matches from the whole library, not a page; cursor semantics
      unchanged; `filtered_total` accompanies it.
- [ ] The search paging loop is deleted when `q` lands.

**Task B**

- [ ] Library rows and `GET /v1/places/{id}` carry top-level `area`, with `parent`,
      `uri` pre-composed, null when the place has no country code or city.
- [ ] `GET /v1/user/library/areas` returns every area with saves and an exact
      count, unpaged, unfiltered, with no ordering guarantee.
- [ ] `?area=<key>` returns one area's saves by prefix, and composes with `q`.
      (`sort=area` is **not** shipping — see §3.)
- [ ] The grouping paging loop is deleted too.
- [ ] Tapping an area header opens the same screen a chat area link opens, for the
      same key — one code path, guaranteed by both sides deriving the key the same
      way.
