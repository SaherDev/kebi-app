/**
 * Place category + tag vocabulary — mirrors kebi's `PlaceCategory`
 * (core/places/models.py) and `TagType` + tag-value enums
 * (core/places/tags.py). This is the cross-repo contract for what values can
 * appear in a {@link PlaceCore}; keep it in sync with kebi as a coordinated
 * change. Note the case asymmetry inherited from kebi: cuisine values are
 * Title-Case ("Thai"), every other tag value is snake_case.
 */

/**
 * Keeps editor autocomplete for the known literals while still accepting any
 * string. kebi types LLM-generated tag types/values as `TagType | str` /
 * `TagValue | str`, so the gateway must tolerate values outside the vocabulary.
 */
export type LiteralUnion<T extends string> = T | (string & {});

// ── Categories (kebi PlaceCategory — strict enum, no free-text) ──────────────
export type PlaceCategory =
  // food & drink
  | "restaurant"
  | "cafe"
  | "bar"
  | "pub"
  | "bakery"
  | "dessert_shop"
  | "ice_cream_shop"
  | "street_food"
  | "food_court"
  | "food_market"
  | "brewery"
  | "winery"
  | "distillery"
  | "tea_house"
  | "juice_bar"
  // retail
  | "grocery_store"
  | "supermarket"
  | "convenience_store"
  | "shopping_mall"
  | "boutique"
  | "bookstore"
  | "specialty_shop"
  | "farmers_market"
  | "flea_market"
  | "night_market"
  | "pharmacy"
  | "electronics_store"
  // culture / sightseeing
  | "museum"
  | "art_gallery"
  | "historical_site"
  | "monument"
  | "temple"
  | "church"
  | "mosque"
  | "shrine"
  | "landmark"
  | "viewpoint"
  // entertainment
  | "theme_park"
  | "amusement_park"
  | "zoo"
  | "aquarium"
  | "botanical_garden"
  | "cinema"
  | "theater"
  | "concert_hall"
  | "live_music_venue"
  | "nightclub"
  | "comedy_club"
  | "karaoke"
  | "arcade"
  | "bowling_alley"
  | "billiards_hall"
  // nature / outdoors
  | "park"
  | "beach"
  | "hiking_trail"
  | "lake"
  | "river"
  | "garden"
  | "campground"
  | "scenic_lookout"
  // fitness / wellness
  | "gym"
  | "fitness_studio"
  | "yoga_studio"
  | "pilates_studio"
  | "spa"
  | "massage"
  | "hot_spring"
  | "bathhouse"
  | "salon"
  | "barber"
  // services / utilities
  | "atm"
  | "bank"
  | "post_office"
  | "gas_station"
  | "parking"
  | "laundry"
  // accommodation
  | "hotel"
  | "hostel"
  | "guesthouse"
  | "bed_and_breakfast"
  | "resort"
  | "vacation_rental"
  // transit
  | "airport"
  | "train_station"
  | "metro_station"
  | "bus_terminal"
  | "ferry_terminal"
  // sport / recreation
  | "stadium"
  | "arena"
  | "sports_club"
  | "swimming_pool"
  | "climbing_gym"
  | "skate_park"
  | "golf_course"
  // work / study
  | "coworking_space"
  | "library"
  | "study_cafe";

// ── Tag types (kebi TagType) ─────────────────────────────────────────────────
export type TagType =
  | "cuisine"
  | "dietary"
  | "feature"
  | "atmosphere"
  | "service"
  | "price"
  | "accessibility"
  | "time"
  | "season";

// ── Tag value enums (kebi tags.py) ───────────────────────────────────────────
export type CuisineTag =
  | "Thai"
  | "Japanese"
  | "Korean"
  | "Chinese"
  | "Italian"
  | "French"
  | "Mexican"
  | "Indian"
  | "Vietnamese"
  | "Mediterranean"
  | "American"
  | "Greek"
  | "Spanish"
  | "Turkish"
  | "Indonesian"
  | "Middle Eastern"
  | "Brazilian"
  | "Seafood"
  | "Steakhouse";

export type DietaryTag = "vegan" | "vegetarian" | "halal" | "vegetarian_options";

export type FeatureTag =
  | "outdoor_seating"
  | "indoor"
  | "outdoor"
  | "rooftop"
  | "waterfront"
  | "garden"
  | "scenic_view"
  | "private_room"
  | "fireplace"
  | "dog_friendly"
  | "family_friendly"
  | "group_friendly"
  | "kids_menu"
  | "sports_viewing"
  | "live_music"
  | "parking"
  | "open_late"
  | "open_24h";

export type AtmosphereTag =
  | "cozy"
  | "romantic"
  | "trendy"
  | "quiet"
  | "lively"
  | "intimate"
  | "spacious"
  | "vibrant"
  | "laid_back"
  | "luxurious"
  | "casual"
  | "upscale"
  | "hidden_gem"
  | "instagram_worthy"
  | "vintage"
  | "industrial"
  | "minimalist"
  | "bohemian"
  | "traditional"
  | "modern";

export type ServiceTag =
  | "dine_in"
  | "takeout"
  | "delivery"
  | "reservable"
  | "serves_breakfast"
  | "serves_brunch"
  | "serves_lunch"
  | "serves_dinner"
  | "serves_beer"
  | "serves_wine"
  | "serves_cocktails";

export type PriceTag = "free" | "budget" | "moderate" | "expensive" | "very_expensive";

export type AccessibilityTag =
  | "wheelchair_parking"
  | "wheelchair_entrance"
  | "wheelchair_restroom"
  | "wheelchair_seating";

export type TimeTag =
  | "morning"
  | "brunch"
  | "lunch"
  | "afternoon"
  | "evening"
  | "night"
  | "late_night"
  | "all_day";

export type SeasonTag =
  | "summer"
  | "winter"
  | "rainy"
  | "spring"
  | "autumn"
  | "all_season";

/** Union of all known tag values (kebi TagValue, minus the `str` escape). */
export type TagValue =
  | CuisineTag
  | DietaryTag
  | FeatureTag
  | AtmosphereTag
  | ServiceTag
  | PriceTag
  | AccessibilityTag
  | TimeTag
  | SeasonTag;

/**
 * One tag on a place. `type` is a known {@link TagType} (or an LLM free-text
 * type); `value` is a known {@link TagValue} (or LLM free-text). `source` is
 * the writer, e.g. "google" | "llm" | "tiktok".
 */
export interface PlaceTag {
  type: LiteralUnion<TagType>;
  value: LiteralUnion<TagValue>;
  source: string;
}
