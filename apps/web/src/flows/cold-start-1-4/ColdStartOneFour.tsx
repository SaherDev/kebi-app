'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Illustration } from '@/components/illustrations/Illustration';
import { PlaceAvatar } from '@/components/PlaceAvatar';
import { getSavedPlaces } from '@/storage/saved-places-storage';
import type { HomeStoreApi } from '@/store/home-store';

interface ColdStartOneFourProps {
  store: HomeStoreApi;
}

export function ColdStartOneFour({ store }: ColdStartOneFourProps) {
  const t = useTranslations('coldStartOneFour');
  const savedPlaces = getSavedPlaces().slice(0, 3);

  return (
    <div className="flex flex-col gap-4 py-4 w-full">

      {/* Kebi message bubble */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-9 w-9 rounded-full overflow-hidden">
          <Illustration id="encouraging" />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 max-w-[85%]">
          <p className="text-sm font-semibold text-foreground">{t('headline')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('subline')}</p>
        </div>
      </div>

      {/* Saved places list */}
      {savedPlaces.length > 0 && (
        <div className="space-y-2">
          {savedPlaces.map((place, idx) => (
            <motion.div
              key={place.place_id ?? idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <PlaceAvatar name={place.place_name} size={44} className="rounded-lg overflow-hidden" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{place.place_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {place.source_url ? (() => { try { return new URL(place.source_url!).hostname.replace('www.', ''); } catch { return 'Saved'; } })() : 'Saved'} · {place.address || 'Bangkok'}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bottom action pill */}
      <div className="flex items-center rounded-full border border-border bg-card overflow-hidden">
        <button
          onClick={() => store.submit('recall a saved place')}
          className="flex-1 px-4 py-3 text-sm text-muted-foreground hover:bg-muted transition-colors text-center"
        >
          {t('alreadySaved')}
        </button>
      </div>

    </div>
  );
}
