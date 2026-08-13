# Open any place, save it from the place screen (ADR-151)

**Date:** 2026-08-07
**Driving change:** kebi ADR-151 — "Every surfaced place is openable; saving needs no ceremony"

## What changed upstream

| Endpoint                    | Before                                          | After                                                                    |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /v1/places/{place_id}` | did not exist                                   | returns `{ place, user_data, claims }` for **any** catalog place; `user_data` is `null` when the caller never saved it |
| `POST /v1/user/places`      | `{ place_core_id, recommendation_id, reason? }` | `{ place_core_id }` — the other two are now **422** (unknown keys)        |
| `POST /v1/signal`           | accept/reject signal                            | **deleted** with the card that fed it                                    |

The place-by-id response is deliberately the same shape as one entry of
`GET /v1/user/library`, so a venue tap and a library row open the identical
screen. The nullable `user_data` is the "offer save" signal.

## Why this repo is behind

- `SaveUserPlaceDto` still **requires** `recommendation_id` — every save would 422.
- `services/api/src/signal/` + `apps/mobile/src/api/signal.ts` call an endpoint that no longer exists.
- `use-open-chat-venue.ts` resolves a venue tap by sweeping up to `LIBRARY_LOOKUP_MAX_PAGES`
  pages of the caller's library — the workaround written when place-by-id did not exist.
  It misses **every discovered place**, which is the thing kebi is for.

## Design (agreed 2026-08-07)

Mockup: `docs/kebi-app-design-system/kebi-place-unsaved-options.html` — **option A**.

The unsaved place screen is not a new screen. It is the place screen with the
user-state layer absent, plus one save action: a filled `ServiceButton` first in
the map/share row. `POST /v1/user/places` returns the created `user_place_id`,
so the screen flips to the saved state in place — no navigation, no refetch.

| Section                        | saved                       | unsaved      | why                                                    |
| ------------------------------ | --------------------------- | ------------ | ------------------------------------------------------ |
| eyebrow · title · dietary pill | shown                       | shown        | pure `place`                                           |
| meta wrapper                   | liked · went · approved · price | price only | the three chips are user-state; the wrapper itself is unchanged |
| approve? amber pill            | shown                       | absent       | PATCHes `user_place_id`                                |
| note / "add a note"            | shown                       | absent       | `user_data.note`                                       |
| **save**                       | absent                      | **shown**    | the flip                                               |
| map · share                    | shown                       | shown        | pure `place`                                           |
| source row                     | shown                       | absent       | an unsaved place has no provenance                     |
| insider notes                  | shown                       | shown        | global approved claims; `from_shared` always false     |
| tags · accessibility           | shown                       | shown        | pure `place`                                           |
| ••• menu (TopPill)             | shown                       | absent       | every item PATCHes or DELETEs                          |

Saved-only affordances stay **hidden** rather than auto-saving on tap: a note tap
should not silently create a library save, and a save-limit error mid-gesture
fails in a confusing place.

## Steps

1. **`libs/shared`** — add `PlaceView` (`user_data: UserPlace | null`); `SavedPlaceView`
   becomes the saved narrowing so every mutating surface keeps its non-null guarantee.
   Shrink `SaveUserPlaceRequest` to `{ place_core_id }`.
2. **`services/api`** — new `places` module: `GET /places/:id` → `/v1/places/{id}`.
   Drop `recommendation_id`/`reason` from `SaveUserPlaceDto` and the forwarded body.
   Delete the `signal` module.
3. **`apps/mobile` api** — `models/place-view.ts` (nullable `user_data`), `api/places.ts`
   (`getPlace`), `places` route entry. Delete `api/signal.ts` + its route.
4. **Place screen** — `/place?id=…`: seed from `place-detail-context` when the list
   surface has the view (instant paint), else fetch; refresh behind the seed.
   Split saved/unsaved rendering; add the save action.
5. **Chat taps** — inline `kebi://venue/{id}` links and rail chips close chat and
   push `/place?id=…&from=chat`. Delete `findSavedPlace` and the library sweep.
6. **Verify** — `pnpm nx affected -t test,lint`.

## Not in scope

Explicit negative taste input is gone with the signal endpoint (ADR-151 accepts
this): the Library pills remain the only negative signal until a future
place-screen affordance replaces it.
