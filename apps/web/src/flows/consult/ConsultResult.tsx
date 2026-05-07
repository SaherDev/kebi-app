'use client';

import type { ConsultResponseData } from '@kebi-app/shared';
import { useTranslations } from 'next-intl';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { PlaceCard } from '../../components/PlaceCard';
import { useHomeStore } from '../../store/home-store';
import { cn } from '@kebi-app/ui';

const SOURCE_BADGE_STYLES: Record<string, { bg: string; dot: string }> = {
  saved:      { bg: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',   dot: 'bg-green-500' },
  discovered: { bg: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300', dot: 'bg-orange-400' },
  suggested:  { bg: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300', dot: 'bg-violet-400' },
};

function SourceBadge({ source }: { source: string }) {
  const t = useTranslations('consult.result.source');
  const style = SOURCE_BADGE_STYLES[source] ?? SOURCE_BADGE_STYLES['discovered'];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold', style.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {t(source as Parameters<typeof t>[0])}
    </span>
  );
}

interface AcceptRejectProps {
  recommendationId: string | null;
  placeId: string;
}

function AcceptRejectActions({ recommendationId, placeId }: AcceptRejectProps) {
  const t = useTranslations('consult.result.actions');
  const acceptPlace = useHomeStore((s) => s.acceptPlace);
  const rejectPlace = useHomeStore((s) => s.rejectPlace);

  if (!recommendationId) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={() => void acceptPlace(recommendationId, placeId)}
        className="flex items-center justify-center h-8 w-8 rounded-full border border-primary/30 bg-primary/5 text-primary transition-colors hover:bg-primary/15 active:scale-95"
        aria-label={t('accept')}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => void rejectPlace(recommendationId, placeId)}
        className="flex items-center justify-center h-8 w-8 rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/80 active:scale-95"
        aria-label={t('reject')}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ConsultResult({ result }: { result: ConsultResponseData }) {
  const t = useTranslations('consult.result');
  const [primary, ...alternatives] = result.results ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Primary PlaceCard — expanded by default */}
      {primary && (
        <>
          <PlaceCard
            place={primary.place}
            defaultExpanded
            badge={<SourceBadge source={primary.source} />}
            action={
              <AcceptRejectActions
                recommendationId={result.recommendation_id}
                placeId={primary.place.place_id}
              />
            }
          />
        </>
      )}

      {/* Alternatives — collapsed, vertical list */}
      {alternatives.length > 0 && (
        <>
          <p className="text-xs italic text-muted-foreground">{t('divider')}</p>
          <div className="flex flex-col gap-3">
            {alternatives.map((alt) => (
              <PlaceCard
                key={alt.place.place_id}
                place={alt.place}
                defaultExpanded
                badge={<SourceBadge source={alt.source} />}
                action={
                  <AcceptRejectActions
                    recommendationId={result.recommendation_id}
                    placeId={alt.place.place_id}
                  />
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
