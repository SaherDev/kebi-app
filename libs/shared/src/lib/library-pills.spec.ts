import { derivePills } from "./library-pills.js";
import type { UserPlace } from "./types.js";

function userData(
  visited: boolean,
  approved: boolean,
  liked: boolean | null = null,
): UserPlace {
  return {
    user_place_id: "u1",
    place_id: "p1",
    approved,
    visited,
    liked,
    note: null,
    source: "manual",
    source_ref: null,
    source_label: null,
    saved_at: "2026-05-01T08:00:00Z",
    visited_at: null,
  };
}

describe("derivePills", () => {
  it("visited + approved → visited + approved (both green)", () => {
    expect(derivePills(userData(true, true))).toEqual([
      { kind: "visited", tone: "green" },
      { kind: "approved", tone: "green" },
    ]);
  });

  it("not visited + not approved → not visited + needs review", () => {
    expect(derivePills(userData(false, false))).toEqual([
      { kind: "notVisited", tone: "warm" },
      { kind: "needsReview", tone: "amber" },
    ]);
  });

  it("visited + not approved → visited + needs review", () => {
    expect(derivePills(userData(true, false))).toEqual([
      { kind: "visited", tone: "green" },
      { kind: "needsReview", tone: "amber" },
    ]);
  });

  it("liked === null → no like pill (two pills only)", () => {
    expect(derivePills(userData(false, true, null))).toEqual([
      { kind: "notVisited", tone: "warm" },
      { kind: "approved", tone: "green" },
    ]);
  });

  it("liked === true → appends 👍 liked (warm, glyph)", () => {
    expect(derivePills(userData(true, true, true))).toEqual([
      { kind: "visited", tone: "green" },
      { kind: "approved", tone: "green" },
      { kind: "liked", tone: "warm", glyph: "👍" },
    ]);
  });

  it("liked === false → appends 👎 disliked (danger, glyph)", () => {
    expect(derivePills(userData(true, true, false))).toEqual([
      { kind: "visited", tone: "green" },
      { kind: "approved", tone: "green" },
      { kind: "disliked", tone: "danger", glyph: "👎" },
    ]);
  });
});
