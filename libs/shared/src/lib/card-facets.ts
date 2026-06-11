import type { PlaceCategory, TagType } from "./place-taxonomy";

/**
 * Per-category card composition strategy (the Library card's detail line).
 *
 * A place's detail line reads `descriptor · facet · price · area`. *Which* tags
 * fill the descriptor and facet slots depends on the kind of place — a
 * restaurant leads with its cuisine and a dietary note, a beach leads with its
 * category and a `waterfront` feature. This map is the single source of truth
 * for that choice, so the card stays a dumb renderer (no `if/switch` on
 * category — strategy pattern, per the repo standards).
 *
 * Mirrors the category buckets in {@link CATEGORY_EMOJI} / kebi's
 * `PlaceCategory`. Keep exhaustive: a missing category is a compile error.
 */

/** The composition group a category belongs to. */
export type CardGroup =
  | "eat_drink"
  | "shop"
  | "culture"
  | "nightlife"
  | "nature"
  | "wellness"
  | "transit"
  | "stay"
  | "sport"
  | "work";

/**
 * How a group fills the detail line's first two slots.
 * - `descriptor`: `cuisine` → use a cuisine tag (eat/drink), else the category label.
 * - `facet`: ordered tag types; the first present tag wins. `[]` → no facet.
 */
export interface CardFacetRule {
  descriptor: "cuisine" | "category";
  facet: TagType[];
}

export const CARD_FACETS: Record<CardGroup, CardFacetRule> = {
  eat_drink: { descriptor: "cuisine", facet: ["dietary", "atmosphere"] },
  nature: { descriptor: "category", facet: ["feature", "atmosphere"] },
  nightlife: { descriptor: "category", facet: ["feature", "atmosphere"] },
  culture: { descriptor: "category", facet: ["atmosphere", "feature"] },
  wellness: { descriptor: "category", facet: ["atmosphere", "feature"] },
  stay: { descriptor: "category", facet: ["feature", "atmosphere"] },
  shop: { descriptor: "category", facet: ["atmosphere", "feature"] },
  sport: { descriptor: "category", facet: ["feature"] },
  work: { descriptor: "category", facet: ["atmosphere"] },
  transit: { descriptor: "category", facet: [] },
};

/**
 * Category → composition group. Exhaustive against {@link PlaceCategory} (a
 * missing or extra key is a compile error), so adding a category to the
 * taxonomy forces a deliberate grouping choice here.
 */
export const CATEGORY_GROUP: Record<PlaceCategory, CardGroup> = {
  // food & drink
  restaurant: "eat_drink",
  cafe: "eat_drink",
  bar: "eat_drink",
  pub: "eat_drink",
  bakery: "eat_drink",
  dessert_shop: "eat_drink",
  ice_cream_shop: "eat_drink",
  street_food: "eat_drink",
  food_court: "eat_drink",
  food_market: "eat_drink",
  brewery: "eat_drink",
  winery: "eat_drink",
  distillery: "eat_drink",
  tea_house: "eat_drink",
  juice_bar: "eat_drink",
  // retail
  grocery_store: "shop",
  supermarket: "shop",
  convenience_store: "shop",
  shopping_mall: "shop",
  boutique: "shop",
  bookstore: "shop",
  specialty_shop: "shop",
  farmers_market: "shop",
  flea_market: "shop",
  night_market: "shop",
  pharmacy: "shop",
  electronics_store: "shop",
  // culture / sightseeing
  museum: "culture",
  art_gallery: "culture",
  historical_site: "culture",
  monument: "culture",
  temple: "culture",
  church: "culture",
  mosque: "culture",
  shrine: "culture",
  landmark: "culture",
  viewpoint: "culture",
  // entertainment / nightlife
  theme_park: "nightlife",
  amusement_park: "nightlife",
  zoo: "nightlife",
  aquarium: "nightlife",
  botanical_garden: "nightlife",
  cinema: "nightlife",
  theater: "nightlife",
  concert_hall: "nightlife",
  live_music_venue: "nightlife",
  nightclub: "nightlife",
  comedy_club: "nightlife",
  karaoke: "nightlife",
  arcade: "nightlife",
  bowling_alley: "nightlife",
  billiards_hall: "nightlife",
  // nature / outdoors
  park: "nature",
  beach: "nature",
  hiking_trail: "nature",
  lake: "nature",
  river: "nature",
  garden: "nature",
  campground: "nature",
  scenic_lookout: "nature",
  // fitness / wellness
  gym: "wellness",
  fitness_studio: "wellness",
  yoga_studio: "wellness",
  pilates_studio: "wellness",
  spa: "wellness",
  massage: "wellness",
  hot_spring: "wellness",
  bathhouse: "wellness",
  salon: "wellness",
  barber: "wellness",
  // services / utilities
  atm: "transit",
  bank: "transit",
  post_office: "transit",
  gas_station: "transit",
  parking: "transit",
  laundry: "transit",
  // accommodation
  hotel: "stay",
  hostel: "stay",
  guesthouse: "stay",
  bed_and_breakfast: "stay",
  resort: "stay",
  vacation_rental: "stay",
  // transit
  airport: "transit",
  train_station: "transit",
  metro_station: "transit",
  bus_terminal: "transit",
  ferry_terminal: "transit",
  // sport / recreation
  stadium: "sport",
  arena: "sport",
  sports_club: "sport",
  swimming_pool: "sport",
  climbing_gym: "sport",
  skate_park: "sport",
  golf_course: "sport",
  // work / study
  coworking_space: "work",
  library: "work",
  study_cafe: "work",
};
