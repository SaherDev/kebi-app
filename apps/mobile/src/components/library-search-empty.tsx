import { Text, View } from 'react-native';
import { useTranslation } from '../i18n/context';

/**
 * Shown when an active search matches nothing (kebi-search-mockup.html
 * "no matches"). The hero + toolbar stay above; this fills the remaining space
 * and centers the message. "clear search" empties the query, returning to the
 * full (filtered) list.
 */
export function LibrarySearchEmpty({ query, onClear }: { query: string; onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-1.5 px-8 pb-28">
      <Text className="text-center text-body font-semibold text-text" numberOfLines={2}>
        {t('library.search.noMatches', { query })}
      </Text>
      <Text className="text-center text-small text-text-muted">
        {t('library.search.tryAgain')}{' '}
        <Text className="font-semibold text-like" onPress={onClear}>
          {t('library.search.clear')}
        </Text>
      </Text>
    </View>
  );
}
