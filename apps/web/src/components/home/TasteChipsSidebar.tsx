'use client';

import type { ChipItem, SignalTier } from '@kebi-app/shared';
import { cn } from '@kebi-app/ui';

interface TasteChipsSidebarProps {
  chips: ChipItem[];
  tier: SignalTier;
}

export function TasteChipsSidebar({ chips, tier }: TasteChipsSidebarProps) {
  if (chips.length === 0) return null;
  if (tier !== 'warming' && tier !== 'active') return null;

  const chipEl = (chip: ChipItem) => (
    <span
      key={chip.label}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs',
        chip.status === 'confirmed' && 'bg-primary text-primary-foreground',
        chip.status === 'rejected' && 'bg-muted text-muted-foreground line-through',
        chip.status === 'pending' && 'border border-border text-foreground',
      )}
    >
      {chip.label}
    </span>
  );

  return (
    /* Desktop only — right rail */
    <aside className="hidden w-52 shrink-0 self-start px-4 pt-6 md:flex md:flex-col md:gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your taste
      </p>
      <div className="flex flex-wrap gap-1.5">{chips.map(chipEl)}</div>
    </aside>
  );
}
