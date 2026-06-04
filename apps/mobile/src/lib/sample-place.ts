import type { PlaceCategory, PlaceCore } from '@kebi-app/shared';

/**
 * Placeholder `PlaceCore` builder for screens whose real data layer isn't wired
 * yet (the library list and place page are still stubs) and the gallery. Lets
 * the long-press / overflow menus be exercised against realistic shapes.
 *
 * TODO: remove once saved places come from the gateway.
 */
export function makeSamplePlace(placeName: string, categories: PlaceCategory[]): PlaceCore {
  return {
    id: placeName,
    provider_id: null,
    place_name: placeName,
    place_name_aliases: [],
    categories,
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
  };
}
