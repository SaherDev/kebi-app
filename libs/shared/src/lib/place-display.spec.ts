import {
  buildDetailSegments,
  findPriceTag,
  humanize,
  placeDisplayName,
} from "./place-display.js";
import type { PlaceCore, SavedPlaceView, UserPlace } from "./types.js";
import type { PlaceTag } from "./place-taxonomy.js";

function place(partial: Partial<PlaceCore>): PlaceCore {
  return {
    id: "p1",
    provider_id: null,
    place_name: "Canonical Name",
    place_name_aliases: [],
    categories: [],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
    ...partial,
  };
}

function tag(type: string, value: string): PlaceTag {
  return { type, value, source: "llm" };
}

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

describe("humanize", () => {
  it("spaces snake_case", () => {
    expect(humanize("hot_spring")).toBe("hot spring");
    expect(humanize("scenic_view")).toBe("scenic view");
    expect(humanize("Japanese")).toBe("Japanese");
  });
});

describe("placeDisplayName", () => {
  const view = (u: Partial<UserPlace>): SavedPlaceView => ({
    place: place({ place_name: "Canonical Name" }),
    user_data: userData(u),
  });

  it("prefers the source label", () => {
    expect(placeDisplayName(view({ source_label: "Mirror Temple" }))).toBe("Mirror Temple");
  });

  it("falls back to the catalog name when no source label", () => {
    expect(placeDisplayName(view({ source_label: null }))).toBe("Canonical Name");
  });
});

describe("findPriceTag", () => {
  it("returns a known price tag", () => {
    expect(findPriceTag(place({ tags: [tag("price", "moderate")] }))).toBe("moderate");
  });

  it("ignores an unknown price value", () => {
    expect(findPriceTag(place({ tags: [tag("price", "cheap")] }))).toBeNull();
  });

  it("returns null with no price tag", () => {
    expect(findPriceTag(place({ tags: [tag("cuisine", "Thai")] }))).toBeNull();
  });
});

describe("buildDetailSegments", () => {
  it("eat/drink: cuisine descriptor, dietary facet, price, neighborhood", () => {
    const segments = buildDetailSegments(
      place({
        categories: ["restaurant"],
        tags: [tag("cuisine", "Japanese"), tag("dietary", "vegan"), tag("price", "moderate")],
        location: {
          lat: null,
          lng: null,
          address: null,
          neighborhood: "Nezu",
          city: "Tokyo",
          country: "JP",
        },
      }),
    );
    expect(segments).toEqual([
      { kind: "text", value: "Japanese" },
      { kind: "text", value: "vegan" },
      { kind: "price", value: "moderate" },
      { kind: "text", value: "Nezu" },
    ]);
  });

  it("nature: category descriptor, feature facet, free price, city fallback for area", () => {
    const segments = buildDetailSegments(
      place({
        categories: ["beach"],
        tags: [tag("feature", "scenic_view"), tag("price", "free")],
        location: {
          lat: null,
          lng: null,
          address: null,
          neighborhood: null,
          city: "Zushi",
          country: "JP",
        },
      }),
    );
    expect(segments).toEqual([
      { kind: "text", value: "beach" },
      { kind: "text", value: "scenic view" },
      { kind: "price", value: "free" },
      { kind: "text", value: "Zushi" },
    ]);
  });

  it("transit: category only, no facet", () => {
    const segments = buildDetailSegments(
      place({
        categories: ["train_station"],
        tags: [tag("feature", "open_24h")],
        location: {
          lat: null,
          lng: null,
          address: null,
          neighborhood: "Shibuya",
          city: "Tokyo",
          country: "JP",
        },
      }),
    );
    expect(segments).toEqual([
      { kind: "text", value: "train station" },
      { kind: "text", value: "Shibuya" },
    ]);
  });

  it("drops every empty segment", () => {
    expect(buildDetailSegments(place({ categories: ["shrine"] }))).toEqual([
      { kind: "text", value: "shrine" },
    ]);
  });
});
