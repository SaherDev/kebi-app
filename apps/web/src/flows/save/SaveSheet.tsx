'use client';

import { useEffect, useRef } from 'react';
import type { ExtractPlaceItem } from '@kebi-app/shared';
import { PlaceCard } from '../../components/PlaceCard';

// ── Badges ─────────────────────────────────────────────────────────────────────

function ConfidencePill({ item }: { item: ExtractPlaceItem }) {
  if (item.status === 'saved') {
    return (
      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
        Saved ✓
      </span>
    );
  }
  if (item.status === 'duplicate') {
    const savedOn = item.place?.created_at
      ? new Date(item.place.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null;
    return (
      <span className="rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {savedOn ? `Duplicate · saved ${savedOn}` : 'Duplicate'}
      </span>
    );
  }
  if (item.status === 'needs_review' && item.confidence != null) {
    return (
      <span className="rounded-full border border-amber-500/50 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {Math.round(item.confidence * 100)}% match
      </span>
    );
  }
  return null;
}

// ── SaveSheet ──────────────────────────────────────────────────────────────────

interface SaveSheetProps {
  places: ExtractPlaceItem[];
  onSavePlace: (item: ExtractPlaceItem) => void;
  onClose: (savedItems: ExtractPlaceItem[]) => void;
}

export function SaveSheet({ places, onSavePlace, onClose }: SaveSheetProps) {
  const cardItems = places.filter((p) => p.place !== null);
  const pendingCount = places.filter((p) => p.place === null && p.status === 'pending').length;
  const failedCount = places.filter((p) => p.place === null && p.status === 'failed').length;

  // Auto-save all items and close immediately — no manual action needed
  const autoSaveFired = useRef(false);
  useEffect(() => {
    if (autoSaveFired.current) return;
    autoSaveFired.current = true;
    cardItems.forEach((item) => onSavePlace(item));
    const savedItems = cardItems.filter((item) => item.place);
    onClose(savedItems);
  }, []); // intentional: run once on mount

  return (
    <div className="flex flex-col gap-3">
      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">{pendingCount} still processing…</p>
      )}
      {failedCount > 0 && (
        <p className="text-xs text-muted-foreground">{failedCount} couldn't be extracted</p>
      )}

      {cardItems.map((item) => (
        <PlaceCard
          key={item.place!.place_id}
          place={item.place!}
          badge={<ConfidencePill item={item} />}
        />
      ))}

      {cardItems.length === 0 && pendingCount === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No places found</p>
      )}
    </div>
  );
}
