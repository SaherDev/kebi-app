import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  type SectionListData,
  Text,
  View,
} from 'react-native';
import type { SavedPlaceView } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { LibraryTopBar } from '../components/library-top-bar';
import { LibraryPlaceCard } from '../components/library-place-card';
import { LibraryAreaHeader } from '../components/library-area-header';
import { LibraryEmpty } from '../components/library-empty';
import { LibrarySearchEmpty } from '../components/library-search-empty';
import { LibrarySearchSkeleton, LibrarySkeleton } from '../components/library-skeleton';
import { ErrorRow } from '../components/error-row';
import { Skeleton } from '../components/skeleton';
import {
  useLibrarySections,
  ELSEWHERE_KEY,
  type LibrarySection,
} from '../components/use-library-sections';
import { useLibrarySearch } from '../components/use-library-search';
import { useSaveSheet } from '../components/save-sheet-context';
import { useToast } from '../components/toast-context';
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
  const toast = useToast();
  const { items: savedItems } = useSavedPlaces();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const library = useLibrarySections();
  const search = useLibrarySearch(trimmed);

  const {
    sections,
    total,
    loading,
    refreshing,
    loadingMore,
    error,
    moreError,
    loadMore,
    refetch,
    refresh,
  } = library;

  // Hero shows the whole stash; fall back to what's loaded until kebi sends `total`.
  const loadedCount = useMemo(
    () => sections.reduce((sum, section) => sum + section.rows.length, 0),
    [sections],
  );
  const stashCount = total ?? loadedCount;

  // A read that fails while the list already has rows never replaces them
  // (ADR-056) — that's a refresh or a background refetch, so it's a toast with
  // a retry and the stale places stay readable. Fires on the transition only.
  const hadErrorRef = useRef(false);
  useEffect(() => {
    if (error && !hadErrorRef.current && sections.length > 0) {
      toast.show({
        tone: 'danger',
        icon: 'alert',
        text: t('library.refreshFailed'),
        action: { label: t('common.retry'), onPress: refresh },
      });
    }
    hadErrorRef.current = error;
  }, [error, sections.length, refresh, toast, t]);

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

  // Both lists render a memoised row, so these have to be stable too — a fresh
  // `renderItem` on every render hands each row a new element and undoes it.
  const highlight = trimmed.toLowerCase();
  const renderMatch = useCallback(
    ({ item }: { item: SavedPlaceView }) => <LibraryPlaceCard view={item} highlight={highlight} />,
    [highlight],
  );
  const renderRow = useCallback(
    ({ item }: { item: SavedPlaceView }) => <LibraryPlaceCard view={item} />,
    [],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<SavedPlaceView, LibrarySection> }) => (
      <View className="pb-1 pt-3">
        <LibraryAreaHeader
          group={section.group}
          tappable={section.tappable}
          here={section.here}
          label={section.group.key === ELSEWHERE_KEY ? t('library.elsewhere') : undefined}
        />
      </View>
    ),
    [t],
  );

  const sectionData = useMemo(
    () => sections.map((section) => ({ ...section, data: section.rows })),
    [sections],
  );

  let body;
  if (searching) {
    // ── Search: flat, whole-library, with the true match count ──────────────
    if (search.loading && search.rows.length === 0) {
      // Two cards in a result's geometry, under a shimmering count — the list
      // is never blanked mid-typing (ADR-056).
      body = (
        <View className="flex-1 px-6 pt-2">
          <LibrarySearchSkeleton />
        </View>
      );
    } else if (search.error) {
      // The query stays in the field, so retry is one tap and not a retype.
      body = (
        <View className="flex-1 px-6 pt-2">
          <ErrorRow
            text={t('library.searchFailed')}
            actionLabel={t('common.retry')}
            onAction={search.retry}
          />
          <LibrarySearchSkeleton frozen />
        </View>
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
          keyExtractor={keyOf}
          renderItem={renderMatch}
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
          ListFooterComponent={
            <ListTail
              loading={search.loadingMore}
              failed={search.moreError}
              onRetry={search.loadMore}
            />
          }
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
      <View className="flex-1 px-6 pt-2">
        <LibrarySkeleton />
      </View>
    );
  } else if (error && sections.length === 0) {
    // The screen keeps the shape it promised: the skeleton freezes and the
    // failure sits on top of it, so a successful retry fills in (ADR-056).
    body = (
      <View className="flex-1 px-6 pt-2">
        <ErrorRow
          text={t('library.error')}
          detail={t('home.nothingLost')}
          actionLabel={t('common.retry')}
          onAction={refetch}
        />
        <LibrarySkeleton frozen />
      </View>
    );
  } else if (sections.length === 0) {
    body = <LibraryEmpty onSave={() => saveSheet.open()} />;
  } else {
    // ── At rest: grouped by area ────────────────────────────────────────────
    body = (
      <SectionList
        sections={sectionData}
        keyExtractor={keyOf}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={<View className="pb-1">{hero}</View>}
        ListFooterComponent={
          <ListTail loading={loadingMore} failed={moreError} onRetry={loadMore} />
        }
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

const keyOf = (view: SavedPlaceView) => view.user_data.user_place_id;

/**
 * The end of a paged list (ADR-056): one skeleton row while the next page is on
 * its way, and — where the old code was silent — one centred line when that page
 * failed. A list that just stops paging is indistinguishable from a list that
 * ended, so the tail says which it is. No dot and no card: the rows above are
 * fine, only their continuation isn't.
 */
function ListTail({
  loading,
  failed,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (failed) {
    return (
      <View className="flex-row items-center justify-center gap-1 py-4">
        <Text className="text-small text-text-muted">{t('library.moreFailed')}</Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          hitSlop={10}
          className={`px-2 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }
  if (!loading) return null;
  return (
    <View className="rounded-large bg-surface p-3">
      <View className="flex-row items-center gap-2.5">
        <Skeleton height={34} width={34} radius="small" className="!bg-bg" />
        <Skeleton height={15} width="52%" className="!bg-bg" />
      </View>
      <View className="mt-2">
        <Skeleton height={12} width="66%" className="!bg-bg" />
      </View>
    </View>
  );
}
