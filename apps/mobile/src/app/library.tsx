import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import type { SavedPlaceView } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { LibraryTopBar } from '../components/library-top-bar';
import { LibraryPlaceCard } from '../components/library-place-card';
import { LibraryAreaHeader } from '../components/library-area-header';
import { LibraryEmpty } from '../components/library-empty';
import { LibrarySearchEmpty } from '../components/library-search-empty';
import { Spinner } from '../components/spinner';
import { useLibrarySections, ELSEWHERE_KEY } from '../components/use-library-sections';
import { useLibrarySearch } from '../components/use-library-search';
import { useSaveSheet } from '../components/save-sheet-context';
import { useSavedPlaces } from '../components/saved-places-context';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * The Library (kebi-library-filter-options.html §1 option A, §4, §5 v1).
 *
 * Two controls and no more: **search**, and **area sections whose headers are
 * links**. The sort sheet, the filter sheet and the toolbar row that opened
 * them are gone — they went unused, and each cost three taps and two
 * animations to reach a single-select chip row.
 *
 * The two modes never mix. At rest the list is sectioned by area, with exact
 * counts from kebi's distribution. While a query is active the sections step
 * aside for a flat result list: a search cuts across areas, so grouping four
 * matches would fragment them into four one-row sections, and the distribution
 * is deliberately unfiltered so its counts would describe a different set than
 * the rows on screen.
 */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const saveSheet = useSaveSheet();
  const { items: savedItems } = useSavedPlaces();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const library = useLibrarySections();
  const search = useLibrarySearch(trimmed);

  const { sections, total, loading, refreshing, loadingMore, error, loadMore, refetch, refresh } =
    library;

  // Hero shows the whole stash; fall back to what's loaded until kebi sends `total`.
  const loadedCount = useMemo(
    () => sections.reduce((sum, section) => sum + section.rows.length, 0),
    [sections],
  );
  const stashCount = total ?? loadedCount;

  // The save sheet is a global overlay, so saving from here never changes screen
  // focus — bridge the in-memory saved count to a refetch so a new save appears.
  const savedCountRef = useRef(savedItems.length);
  useEffect(() => {
    if (savedItems.length !== savedCountRef.current) {
      savedCountRef.current = savedItems.length;
      refetch();
    }
  }, [savedItems.length, refetch]);

  const hero = (
    <View>
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {t('library.eyebrow')}
      </Text>
      <Text className="mt-1 text-[34px] font-bold leading-tight text-text">
        {t('library.heroCount', { count: stashCount })}
        <Text className="text-text-muted">{t('library.heroSuffix')}</Text>
      </Text>
    </View>
  );

  const renderCard = (view: SavedPlaceView, highlight?: string) => (
    <LibraryPlaceCard view={view} highlight={highlight} />
  );

  let body;
  if (searching) {
    // ── Search: flat, whole-library, with the true match count ──────────────
    if (search.loading && search.rows.length === 0) {
      body = (
        <View className="flex-1 items-center justify-center pb-28">
          <Spinner />
        </View>
      );
    } else if (search.error) {
      body = (
        <LibraryError onRetry={search.retry} label={t('library.error')} cta={t('library.retry')} />
      );
    } else if (search.rows.length === 0) {
      body = (
        <View className="flex-1 px-6 pt-2">
          <LibrarySearchEmpty query={trimmed} onClear={() => setQuery('')} />
        </View>
      );
    } else {
      body = (
        <FlatList
          data={search.rows}
          keyExtractor={(view) => view.user_data.user_place_id}
          renderItem={({ item }) => renderCard(item, trimmed.toLowerCase())}
          ListHeaderComponent={
            <View className="pb-2 pt-1">
              <Text className="px-1 text-small text-text-muted">
                {t('library.matchCount', {
                  count: search.filteredTotal ?? search.rows.length,
                  total: stashCount,
                })}
              </Text>
            </View>
          }
          ListFooterComponent={search.loadingMore ? <ListSpinner /> : null}
          onEndReached={search.loadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-2 px-6 pb-28 pt-2"
        />
      );
    }
  } else if (loading && sections.length === 0) {
    body = (
      <View className="flex-1 items-center justify-center pb-28">
        <Spinner />
      </View>
    );
  } else if (error && sections.length === 0) {
    body = <LibraryError onRetry={refetch} label={t('library.error')} cta={t('library.retry')} />;
  } else if (sections.length === 0) {
    body = <LibraryEmpty />;
  } else {
    // ── At rest: grouped by area ────────────────────────────────────────────
    body = (
      <SectionList
        sections={sections.map((section) => ({ ...section, data: section.rows }))}
        keyExtractor={(view) => view.user_data.user_place_id}
        renderItem={({ item }) => renderCard(item)}
        renderSectionHeader={({ section }) => (
          <View className="pb-1 pt-3">
            <LibraryAreaHeader
              group={section.group}
              tappable={section.tappable}
              here={section.here}
              label={section.group.key === ELSEWHERE_KEY ? t('library.elsewhere') : undefined}
            />
          </View>
        )}
        ListHeaderComponent={<View className="pb-1">{hero}</View>}
        ListFooterComponent={loadingMore ? <ListSpinner /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="gap-2 px-6 pb-28 pt-2"
      />
    );
  }

  return (
    <View className="flex-1">
      <ScreenScaffold
        topBar={
          <LibraryTopBar
            query={query}
            onQueryChange={setQuery}
            onSave={() => saveSheet.open()}
          />
        }
      >
        {body}
      </ScreenScaffold>
    </View>
  );
}

function ListSpinner() {
  return (
    <View className="items-center py-4">
      <Spinner />
    </View>
  );
}

interface LibraryErrorProps {
  onRetry: () => void;
  label: string;
  cta: string;
}

function LibraryError({ onRetry, label, cta }: LibraryErrorProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6 pb-28">
      <Text className="text-center text-body text-text-muted">{label}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={cta}
        className={`rounded-card bg-text px-5 py-3 ${PRESS}`}
      >
        <Text className="text-small font-semibold text-bg">{cta}</Text>
      </Pressable>
    </View>
  );
}
