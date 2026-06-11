import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { placeDisplayName, type SavedPlaceView } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { LibraryTopBar } from '../components/library-top-bar';
import { LibraryToolbar } from '../components/library-toolbar';
import { LibraryPlaceCard } from '../components/library-place-card';
import { LibraryEmpty } from '../components/library-empty';
import { LibraryFilterSheet } from '../components/library-filter-sheet';
import { LibrarySortSheet } from '../components/library-sort-sheet';
import { Spinner } from '../components/spinner';
import { useLibrary } from '../components/use-library';
import { useLibraryActions } from '../components/use-library-actions';
import { useSaveSheet } from '../components/save-sheet-context';
import { useSavedPlaces } from '../components/saved-places-context';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/** Does a saved place match the free-text search (client-side, over loaded rows)? */
function matchesQuery(view: SavedPlaceView, query: string): boolean {
  if (!query) return true;
  const { place } = view;
  const haystack = [
    placeDisplayName(view),
    place.place_name,
    place.location?.neighborhood ?? '',
    place.location?.city ?? '',
    ...place.tags.map((tag) => tag.value),
    ...place.categories,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

export default function LibraryScreen() {
  const { t } = useTranslation();
  const saveSheet = useSaveSheet();
  const library = useLibrary();
  const actions = useLibraryActions(library);
  const { items: savedItems } = useSavedPlaces();
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const {
    views,
    loading,
    refreshing,
    loadingMore,
    error,
    total,
    sort,
    status,
    setSort,
    setStatus,
    loadMore,
    refetch,
    refresh,
  } = library;

  // Hero shows the whole stash (kebi's grand total); fall back to the loaded
  // count until kebi ships `total`.
  const stashCount = total ?? views.length;

  // The save sheet is a global overlay, so saving from here never changes screen
  // focus — bridge the in-memory saved count to a refetch so a new save appears.
  const savedCountRef = useRef(savedItems.length);
  useEffect(() => {
    if (savedItems.length !== savedCountRef.current) {
      savedCountRef.current = savedItems.length;
      refetch();
    }
  }, [savedItems.length, refetch]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () => views.filter((view) => matchesQuery(view, normalizedQuery)),
    [views, normalizedQuery],
  );

  const header = (
    <View className="gap-5 pb-1">
      <View>
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('library.eyebrow')}
        </Text>
        <Text className="mt-1 text-[34px] font-bold leading-tight text-text">
          {t('library.heroCount', { count: stashCount })}
          <Text className="text-text-muted">{t('library.heroSuffix')}</Text>
        </Text>
      </View>
      <LibraryToolbar
        count={filtered.length}
        sort={sort}
        onOpenSort={() => setSortOpen(true)}
        onOpenFilter={() => setFilterOpen(true)}
      />
    </View>
  );

  let body;
  if (loading && views.length === 0) {
    body = (
      <View className="flex-1 items-center justify-center pb-28">
        <Spinner />
      </View>
    );
  } else if (error && views.length === 0) {
    body = (
      <View className="flex-1 items-center justify-center gap-4 px-6 pb-28">
        <Text className="text-center text-body text-text-muted">{t('library.error')}</Text>
        <Pressable
          onPress={refetch}
          accessibilityRole="button"
          accessibilityLabel={t('library.retry')}
          className={`rounded-card bg-text px-5 py-3 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-bg">{t('library.retry')}</Text>
        </Pressable>
      </View>
    );
  } else if (views.length === 0) {
    body = <LibraryEmpty />;
  } else {
    body = (
      <FlatList
        data={filtered}
        keyExtractor={(view) => view.user_data.user_place_id}
        renderItem={({ item, index }) => (
          <LibraryPlaceCard view={item} initiallyExpanded={index === 0} actions={actions} />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={
          loadingMore ? (
            <View className="items-center py-4">
              <Spinner />
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-2 px-6 pb-28 pt-2"
      />
    );
  }

  return (
    <View className="flex-1">
      <ScreenScaffold
        topBar={<LibraryTopBar query={query} onQueryChange={setQuery} onSave={saveSheet.open} />}
      >
        {body}
      </ScreenScaffold>
      <LibrarySortSheet
        open={sortOpen}
        sort={sort}
        onClose={() => setSortOpen(false)}
        onApply={setSort}
      />
      <LibraryFilterSheet
        open={filterOpen}
        status={status}
        onClose={() => setFilterOpen(false)}
        onApply={setStatus}
      />
    </View>
  );
}
