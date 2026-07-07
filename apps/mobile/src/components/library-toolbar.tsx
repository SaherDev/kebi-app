import { Pressable, Text, View } from 'react-native';
import { PRESS } from '../theme/motion';
import { Icon } from './icon';
import { useTranslation } from '../i18n/context';
import type { LibrarySort } from './use-library';

/**
 * The Library toolbar row (kebi-library-mockup.html `.toolbar-row`): the result
 * count on the left, a recent↔A–Z sort toggle and a filter button on the right.
 * It scrolls with the list (it is the list header), not pinned.
 */

interface LibraryToolbarProps {
  count: number;
  sort: LibrarySort;
  onOpenSort: () => void;
  onOpenFilter: () => void;
}

export function LibraryToolbar({ count, sort, onOpenSort, onOpenFilter }: LibraryToolbarProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between px-1 py-1">
      <Text className="text-small text-text-muted">{t('library.results', { count })}</Text>
      <View className="flex-row gap-2">
        <Pressable
          onPress={onOpenSort}
          accessibilityRole="button"
          accessibilityLabel={t('library.sortAction')}
          className={`flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-[7px] ${PRESS}`}
        >
          <Icon name="sort" size={13} className="text-text-muted" />
          <Text className="text-[13px] font-medium text-text">{t(`library.sort.${sort}`)}</Text>
        </Pressable>
        <Pressable
          onPress={onOpenFilter}
          accessibilityRole="button"
          accessibilityLabel={t('library.filter.title')}
          className={`flex-row items-center gap-1.5 rounded-full bg-surface px-3 py-[7px] ${PRESS}`}
        >
          <Icon name="filter" size={13} className="text-text-muted" />
          <Text className="text-[13px] font-medium text-text">{t('library.filter.cta')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
