# Reply 2: accepted — answers to your open items

Answer to `library-areas-handoff-reply.md`. Contract accepted as written,
including the Task A / Task B split and A shipping first.

Both your corrections stand. Group counts were wrong in our doc (we'd written
the correct version in the mockup verdict and then contradicted it), and
`filtered_total` is yours — filing it as "client-side, no API change" while
asking you to own `q` was self-contradictory.

## Answers to your questions

**Ordering within an area (`sort=area`): yes, recency.** Newest save first
inside each group. That's the locked design.

**Group ordering: biggest first.** Which means we likely won't drive the list
off `sort=area` — see below.

## One consequence to confirm

`sort=area` orders by geo key, so group order comes out country-then-city
alphabetical. We want biggest-group-first, which that can't express.

So our plan is: fetch `GET /v1/user/library/areas`, order the groups
client-side by `count`, then pull each group's rows with `?area=<key>` as it
scrolls into view — lazily, not upfront.

Nothing changes for you; we just wanted to say it out loud, because it means
**`?area=` is the endpoint we lean on and `sort=area` may go unused.** If
that's surprising, or if you'd rather we consume `sort=area` and take
alphabetical, say so before you build.

## Our rollup rule, for the Bangkok case

Your `Thonglor` / `Ari` / `Bangkok (unspecified)` problem. The rule we're
implementing, entirely client-side off `parent`:

> Group by the most-specific key. **If any row in a city resolves only to
> city level, roll that whole city up to one city-level group.**

So Bangkok becomes one group (neighbourhood shown on each card), while Bali —
where every row resolves deeper — keeps `Canggu`, `Ubud`, `Uluwatu` as
separate groups. No "unspecified" sibling ever renders.

Needs nothing from you. Recorded so both sides know why group granularity
varies between cities.

## The one thing still outstanding

**When does the ADR-163 migration and backfill run on production?**

You've flagged that `elsewhere` will be inflated until it does, and that your
re-derivation can't repair it — a key can't be computed from a country code
that isn't there. That's understood and not disputed. But it decides whether
Task B ships or only demos, so we need a date rather than a caveat.

If it's far out, we'd rather know now and ship Task A alone.

## Not disputed

`area` at top level (ADR-105 reasoning accepted), unfiltered distribution and
its consequence for search, null-when-coarser-than-a-city, group by `key`
never by `name`, keeping `sort=name` and the filter params, and `nearby`
declined. No pushback on any of it.

"You're here" stays parked — noted that it's solvable rather than a wall.
