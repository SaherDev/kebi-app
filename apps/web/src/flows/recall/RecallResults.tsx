'use client';

import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import type { RecallResult } from '@kebi-app/shared';
import { PlaceCard } from '../../components/PlaceCard';
import { cn } from '@kebi-app/ui';

function MatchReasonBadge({ reason }: { reason: string }) {
  return (
    <span className="rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground">
      {reason}
    </span>
  );
}

interface RecallResultsProps {
  results: RecallResult[];
  totalCount: number;
  breadcrumb: boolean;
  onModeOverride: () => void;
}

export function RecallResults({ results, totalCount, breadcrumb, onModeOverride }: RecallResultsProps) {
  const t = useTranslations('recall');
  const hasMore = totalCount > results.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <AnimatePresence>
        {breadcrumb && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <p className={cn('text-xs text-muted-foreground animate-pulse')}>{t('breadcrumb')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode override pill */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onModeOverride}
        className="self-start text-xs text-primary transition-colors hover:text-primary/80 border border-primary/20 rounded-full px-3 py-1.5"
      >
        {t('modeOverride')}
      </motion.button>

      {/* Results list */}
      <div className="flex flex-col gap-3">
        <AnimatePresence>
          {results.map((item, idx) => (
            <motion.div
              key={item.place.place_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <PlaceCard
                place={item.place}
                badge={<MatchReasonBadge reason={item.match_reason} />}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {results.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{t('emptyFooter')}</p>
        </motion.div>
      )}

      {/* "Showing N of M" hint */}
      {hasMore && results.length > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-muted-foreground"
        >
          Showing {results.length} of {totalCount} saved places
        </motion.p>
      )}
    </div>
  );
}
