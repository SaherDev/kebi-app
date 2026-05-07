import type { SavedPlaceStub } from '@kebi-app/shared';

const COUNT_KEY = 'kebi-app.savedCount';
const PLACES_KEY = 'kebi-app.savedPlaces';

export function getSavedPlaceCount(): number {
  try {
    const raw = localStorage.getItem(COUNT_KEY);
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  } catch {
    return 0;
  }
}

export function setSavedPlaceCount(count: number): void {
  try {
    localStorage.setItem(COUNT_KEY, String(count));
  } catch {
    // localStorage unavailable — no-op
  }
}

export function incrementSavedPlaceCount(): void {
  setSavedPlaceCount(getSavedPlaceCount() + 1);
}

export function getSavedPlaces(): SavedPlaceStub[] {
  try {
    const raw = localStorage.getItem(PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendSavedPlace(place: SavedPlaceStub): void {
  try {
    const places = getSavedPlaces();
    places.push(place);
    localStorage.setItem(PLACES_KEY, JSON.stringify(places.slice(-30)));
  } catch {
    // localStorage unavailable — no-op
  }
}

export function clearSavedPlaces(): void {
  try {
    localStorage.removeItem(COUNT_KEY);
    localStorage.removeItem(PLACES_KEY);
  } catch {
    // localStorage unavailable — no-op
  }
}
