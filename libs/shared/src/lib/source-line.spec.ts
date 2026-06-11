import { parseSourceHandle, sourceLineText } from "./source-line.js";
import type { UserPlace } from "./types.js";

function userData(partial: Partial<UserPlace>): UserPlace {
  return {
    user_place_id: "u1",
    place_id: "p1",
    approved: false,
    visited: false,
    liked: null,
    note: null,
    source: "manual",
    source_ref: null,
    source_label: null,
    saved_at: "2026-05-01T08:00:00Z",
    visited_at: null,
    ...partial,
  };
}

describe("parseSourceHandle", () => {
  it("pulls a tiktok handle", () => {
    expect(parseSourceHandle("https://www.tiktok.com/@onlyfoodsushi/video/123")).toBe(
      "@onlyfoodsushi",
    );
  });

  it("pulls an instagram profile handle", () => {
    expect(parseSourceHandle("https://www.instagram.com/onlyfoodsushi/")).toBe("@onlyfoodsushi");
  });

  it("pulls a youtube @channel handle", () => {
    expect(parseSourceHandle("https://www.youtube.com/@japantrails")).toBe("@japantrails");
  });

  it("returns null for an instagram post (no username)", () => {
    expect(parseSourceHandle("https://www.instagram.com/p/Cxyz123/")).toBeNull();
  });

  it("returns null for a youtube watch url", () => {
    expect(parseSourceHandle("https://www.youtube.com/watch?v=abc123")).toBeNull();
  });

  it("returns null for a null ref", () => {
    expect(parseSourceHandle(null)).toBeNull();
  });
});

describe("sourceLineText", () => {
  it("returns the handle when the url has one", () => {
    expect(
      sourceLineText(userData({ source: "tiktok", source_ref: "https://www.tiktok.com/@chef/v/1" })),
    ).toEqual({ handle: "@chef" });
  });

  it("falls back to the source label key otherwise", () => {
    expect(
      sourceLineText(userData({ source: "instagram", source_ref: "https://www.instagram.com/p/Cx/" })),
    ).toEqual({ labelKey: "instagram" });
  });

  it("uses the source key for manual saves with no ref", () => {
    expect(sourceLineText(userData({ source: "manual", source_ref: null }))).toEqual({
      labelKey: "manual",
    });
  });
});
