import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnstableNativeVariable } from 'nativewind';
import { useRouter } from 'expo-router';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { useTranslation } from '../i18n/context';

/**
 * Library top bar (kebi-library-mockup.html `.top-bar`): pinned above the scroll.
 * Default shows the back button and a pill with search + save triggers. Tapping
 * search expands an input that fills the pill (back + save tuck away, matching
 * the mockup's `.searching` state); clearing an empty field collapses it.
 */

interface LibraryTopBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSave: () => void;
}

export function LibraryTopBar({ query, onQueryChange, onSave }: LibraryTopBarProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mutedColor = useUnstableNativeVariable('--text-muted') ?? undefined;
  const [searching, setSearching] = useState(false);

  const collapse = () => {
    onQueryChange('');
    setSearching(false);
  };

  return (
    <View className="flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
      {searching ? null : (
        <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />
      )}
      <View
        className={`flex-row items-center rounded-full bg-surface px-1 ${
          searching ? 'ms-0 flex-1' : 'ms-auto'
        }`}
      >
        {searching ? (
          <>
            <Icon name="search" size={16} className="ms-2 text-text-muted" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={onQueryChange}
              placeholder={t('library.searchPlaceholder')}
              placeholderTextColor={mutedColor}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="h-9 flex-1 px-2 text-body text-text"
            />
            <IconButton
              icon="close"
              label={t('common.close')}
              variant="pill"
              tone="text-text-muted"
              onPress={() => (query ? onQueryChange('') : collapse())}
            />
          </>
        ) : (
          <>
            <IconButton
              icon="search"
              label={t('common.search')}
              variant="pill"
              onPress={() => setSearching(true)}
            />
            <IconButton
              icon="share-in"
              label={t('nav.savePlace')}
              variant="pill"
              onPress={onSave}
            />
          </>
        )}
      </View>
    </View>
  );
}
