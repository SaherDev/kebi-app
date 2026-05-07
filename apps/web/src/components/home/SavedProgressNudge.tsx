'use client';

import { useTranslations } from 'next-intl';
import type { SignalTier } from '@kebi-app/shared';

interface SavedProgressNudgeProps {
  count: number;
  tier: SignalTier;
}

export function SavedProgressNudge({ count, tier }: SavedProgressNudgeProps) {
  const t = useTranslations('savedProgress');

  if (tier !== 'warming' || count >= 5) return null;

  const pct = Math.min(Math.round((count / 5) * 100), 100);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-4 py-3">
      <p className="text-xs text-muted-foreground">{t('label', { count })}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
