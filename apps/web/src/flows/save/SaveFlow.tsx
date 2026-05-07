'use client';

import { AnimatePresence } from 'framer-motion';
import type { HomeStoreApi } from '@/store/home-store';
import type { ExtractPlaceItem } from '@kebi-app/shared';
import { SaveSheet } from './SaveSheet';

interface SaveFlowProps {
  store: HomeStoreApi;
}

export function SaveFlow({ store }: SaveFlowProps) {
  const { saveSheetPlaces, phase } = store;

  return (
    <AnimatePresence mode="wait">
      {phase === 'save-sheet' && (
        <SaveSheet
          key="sheet"
          places={saveSheetPlaces}
          onSavePlace={(item: ExtractPlaceItem) => store.saveIndividualFromSheet(item)}
          onClose={(savedItems: ExtractPlaceItem[]) => {
            if (savedItems.length > 0) {
              store.closeSaveSheetWithResults(savedItems);
            } else {
              store.dismissSaveSheet();
            }
          }}
        />
      )}
    </AnimatePresence>
  );
}
