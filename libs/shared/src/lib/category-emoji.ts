import type { PlaceCategory } from "./place-taxonomy.js";

/**
 * Category → default avatar emoji. Typed as `Record<PlaceCategory, string>`
 * so it stays exhaustive: a missing or extra key is a compile error, which is
 * the 1:1 guarantee against the {@link PlaceCategory} enum.
 *
 * This is the data source of truth (design-system.md §Data Model Bindings).
 * `docs/kebi-app-design-system/kebi-category-emoji.js` is the visual reference
 * mirror — keep the two in sync.
 */
export const CATEGORY_EMOJI: Record<PlaceCategory, string> = {
  // food & drink
  restaurant: "🍽️",
  cafe: "☕",
  bar: "🍷",
  pub: "🍺",
  bakery: "🥐",
  dessert_shop: "🍰",
  ice_cream_shop: "🍦",
  street_food: "🌮",
  food_court: "🍱",
  food_market: "🥗",
  brewery: "🍻",
  winery: "🍇",
  distillery: "🥃",
  tea_house: "🍵",
  juice_bar: "🥤",
  // retail
  grocery_store: "🛒",
  supermarket: "🛒",
  convenience_store: "🏪",
  shopping_mall: "🛍️",
  boutique: "👗",
  bookstore: "📚",
  specialty_shop: "🎁",
  farmers_market: "🥕",
  flea_market: "🪙",
  night_market: "🏮",
  pharmacy: "💊",
  electronics_store: "🎧",
  // culture / sightseeing
  museum: "🏛️",
  art_gallery: "🎨",
  historical_site: "🏰",
  monument: "🗿",
  temple: "🛕",
  church: "⛪",
  mosque: "🕌",
  shrine: "⛩️",
  landmark: "📍",
  viewpoint: "👁️",
  // entertainment
  theme_park: "🎡",
  amusement_park: "🎢",
  zoo: "🦁",
  aquarium: "🐠",
  botanical_garden: "🌿",
  cinema: "🎬",
  theater: "🎭",
  concert_hall: "🎼",
  live_music_venue: "🎸",
  nightclub: "🪩",
  comedy_club: "🎤",
  karaoke: "🎤",
  arcade: "🕹️",
  bowling_alley: "🎳",
  billiards_hall: "🎱",
  // nature / outdoors
  park: "🌳",
  beach: "🏖️",
  hiking_trail: "🥾",
  lake: "🏞️",
  river: "🏞️",
  garden: "🌸",
  campground: "🏕️",
  scenic_lookout: "🌄",
  // fitness / wellness
  gym: "🏋️",
  fitness_studio: "🤸",
  yoga_studio: "🧘",
  pilates_studio: "🧘",
  spa: "💆",
  massage: "💆",
  hot_spring: "♨️",
  bathhouse: "🛁",
  salon: "💇",
  barber: "💈",
  // services / utilities
  atm: "🏧",
  bank: "🏦",
  post_office: "📮",
  gas_station: "⛽",
  parking: "🅿️",
  laundry: "🧺",
  // accommodation
  hotel: "🏨",
  hostel: "🛏️",
  guesthouse: "🏡",
  bed_and_breakfast: "🛏️",
  resort: "🏝️",
  vacation_rental: "🏠",
  // transit
  airport: "✈️",
  train_station: "🚆",
  metro_station: "🚇",
  bus_terminal: "🚌",
  ferry_terminal: "⛴️",
  // sport / recreation
  stadium: "🏟️",
  arena: "🏟️",
  sports_club: "🏅",
  swimming_pool: "🏊",
  climbing_gym: "🧗",
  skate_park: "🛹",
  golf_course: "⛳",
  // work / study
  coworking_space: "💻",
  library: "📖",
  study_cafe: "✏️",
};

/** Fallback avatar when a place has no category or an unmapped one. */
export const CATEGORY_EMOJI_FALLBACK = "📍";

/**
 * Per-save source identifiers (provenance), not a `PlaceCore` field. Mirrors the
 * kebi `PlaceSource` enum 1:1 — the single source-vocabulary truth for both the
 * "saved from" label and the save sheet's live-detection hint.
 */
export type PlaceSource =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "google_maps_list"
  | "manual"
  | "kebi";

/**
 * Source identifier → display label for the "saved from" row.
 * Resolve the key from the save's source (`user_places.source_label` or a
 * `place_name_aliases[].source` value) — see design-system.md §Sources → labels.
 */
export const SOURCE_LABEL: Record<PlaceSource, string> = {
  tiktok: "saved from tiktok",
  instagram: "saved from instagram",
  youtube: "saved from youtube",
  google_maps_list: "from a maps list",
  manual: "added by you",
  kebi: "kebi found this",
};
