'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { ExtractPlaceItem } from '@kebi-app/shared';

interface SaveResultBubbleProps {
  item: ExtractPlaceItem;
  sourceUrl: string | null;
}

export function SaveResultBubble({ item, sourceUrl }: SaveResultBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const place = item.place;

  if (!place) {
    return (
      <div className="flex gap-2 transition-opacity duration-200" style={{ opacity: visible ? 1 : 0 }}>
        <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Place saved{sourceUrl ? ` from ${sourceUrl}` : ''}</p>
        </div>
      </div>
    );
  }

  const meta = [place.attributes.cuisine, place.attributes.price_hint, place.address]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className="flex gap-2 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex max-w-[85%] items-start gap-3 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">{place.place_name}</p>
          {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
          {sourceUrl && <p className="truncate text-xs text-muted-foreground/70">{sourceUrl}</p>}
          <p className="mt-0.5 text-xs font-medium text-green-600 dark:text-green-400">Saved to your list</p>
        </div>
      </div>
    </div>
  );
}
