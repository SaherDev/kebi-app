import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LibraryStatusFilter } from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';
import { BottomSheet } from './bottom-sheet';

/**
 * Library filter sheet (kebi-library-mockup.html `.sheet`). The status buckets
 * (all / visited / not-visited / needs-review) and reset/apply, rendered inside
 * the shared {@link BottomSheet} shell. Single-select; tapping a chip stages a
 * draft, `apply` commits it (and closes), `reset` returns to `all`. The draft
 * re-syncs to the live applied `status` each time the sheet opens.
 */

interface LibraryFilterSheetProps {
  open: boolean;
  status: LibraryStatusFilter;
  onClose: () => void;
  onApply: (status: LibraryStatusFilter) => void;
}

const STATUS_OPTIONS: LibraryStatusFilter[] = [
  'all',
  'beenSaved',
  'new',
  'approved',
  'approve',
];

export function LibraryFilterSheet({ open, status, onClose, onApply }: LibraryFilterSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<LibraryStatusFilter>(status);

  // Sync the draft to the applied status each time the sheet opens.
  useEffect(() => {
    if (open) setDraft(status);
  }, [open, status]);

  return (
    <BottomSheet open={open} title={t('library.filter.title')} onClose={onClose}>
      <View className="gap-2">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('library.filter.status')}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((option) => {
            const active = draft === option;
            return (
              <Pressable
                key={option}
                onPress={() => setDraft(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`library.filter.${option}`)}
                className={`rounded-full px-3 py-[7px] ${active ? 'bg-text' : 'bg-surface'}`}
              >
                <Text className={`text-[13px] font-medium ${active ? 'text-bg' : 'text-text'}`}>
                  {t(`library.filter.${option}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mt-1 flex-row gap-2">
        <Pressable
          onPress={() => setDraft('all')}
          accessibilityRole="button"
          accessibilityLabel={t('library.filter.reset')}
          className={`flex-1 items-center rounded-card bg-surface px-4 py-3 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{t('library.filter.reset')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('library.filter.apply')}
          className={`flex-1 items-center rounded-card bg-text px-4 py-3 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-bg">{t('library.filter.apply')}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
