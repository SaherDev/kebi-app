'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { RecallResponseData } from '@kebi-app/shared';
import { PlaceCard } from '@/components/PlaceCard';

interface RecallResultBubbleProps {
  message: string;
  data: RecallResponseData;
}

function MatchReasonBadge({ reason }: { reason: string }) {
  return (
    <span className="rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10px] text-muted-foreground">
      {reason}
    </span>
  );
}

export function RecallResultBubble({ message, data }: RecallResultBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const results = data.results ?? [];
  const hasMore = data.total_count > results.length;

  return (
    <div
      className="flex flex-col gap-3 transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="flex flex-col gap-3">
        {results.map((item, i) => (
          <motion.div
            key={item.place.place_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <PlaceCard
              place={item.place}
              badge={<MatchReasonBadge reason={item.match_reason} />}
            />
          </motion.div>
        ))}
      </div>

      {hasMore && (
        <p className="text-center text-xs text-muted-foreground/60">
          Showing {results.length} of {data.total_count} saved places
        </p>
      )}
    </div>
  );
}
