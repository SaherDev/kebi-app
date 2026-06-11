import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';
import { BottomSheet } from './bottom-sheet';
import type { LibrarySort } from './use-library';

/**
 * Library sort sheet — the order options (recent / A–Z) and reset/apply, in the
 * shared {@link BottomSheet} shell so it speaks the same language as the filter
 * sheet. Single-select; tapping an order stages a draft, `apply` commits it (and
 * closes), `reset` returns to `recent` (the default). Applying refetches from
 * page 1 — sort is a server param and the keyset cursor is sort-bound
 * (api-contract.md §GET /v1/user/library). The draft re-syncs to the live
 * applied `sort` each time the sheet opens.
 */

interface LibrarySortSheetProps {
  open: boolean;
  sort: LibrarySort;
  onClose: () => void;
  onApply: (sort: LibrarySort) => void;
}

const SORT_OPTIONS: LibrarySort[] = ['recent', 'name'];

export function LibrarySortSheet({ open, sort, onClose, onApply }: LibrarySortSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<LibrarySort>(sort);

  // Sync the draft to the applied sort each time the sheet opens.
  useEffect(() => {
    if (open) setDraft(sort);
  }, [open, sort]);

  return (
    <BottomSheet open={open} title={t('library.sort.title')} onClose={onClose}>
      <View className="gap-2">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('library.sort.label')}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {SORT_OPTIONS.map((option) => {
            const active = draft === option;
            return (
              <Pressable
                key={option}
                onPress={() => setDraft(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`library.sort.${option}`)}
                className={`rounded-full px-3 py-[7px] ${active ? 'bg-text' : 'bg-surface'}`}
              >
                <Text className={`text-[13px] font-medium ${active ? 'text-bg' : 'text-text'}`}>
                  {t(`library.sort.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-1 flex-row gap-2">
        <Pressable
          onPress={() => setDraft('recent')}
          accessibilityRole="button"
          accessibilityLabel={t('library.sort.reset')}
          className={`flex-1 items-center rounded-card bg-surface px-4 py-3 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{t('library.sort.reset')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('library.sort.apply')}
          className={`flex-1 items-center rounded-card bg-text px-4 py-3 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-bg">{t('library.sort.apply')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
