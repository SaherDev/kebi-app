import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useUnstableNativeVariable } from 'nativewind';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';
import { Spinner } from './spinner';
import { useEntitySearch } from './use-entity-search';
import type { EntityHit } from '../api/models/knowledge';
import type { CurateAnchorView } from './curate-sheet';

/** Search affordance glyph, decorative only. */
const SEARCH_GLYPH = '\u{1F50E}';

/**
 * The anchor chip — what the prose is about, and where it gets changed
 * (kebi-curate-options.html §3, picker 1).
 *
 * It expands **in place** rather than opening a second sheet: the composer is
 * already a sheet, and stacking one on another would dim the prose you are
 * anchoring and give swipe-down two meanings. Expanding is also the move the
 * library top-pill already makes, so the gesture is in the app's vocabulary.
 *
 * Collapsed it is a chip; tapped it becomes a search field with results directly
 * beneath. The prose stays on screen underneath either way — the sheet dims it,
 * it never unmounts, so nothing typed can be lost by looking something up.
 */
interface CurateAnchorChipProps {
  anchor: CurateAnchorView | null;
  /** True while the chip is in search mode — owned by the sheet. */
  searching: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onStartSearch: () => void;
  /** Abandon the search, restoring whatever was anchored before. */
  onCancelSearch: () => void;
  onPick: (hit: EntityHit) => void;
}

export function CurateAnchorChip({
  anchor,
  searching,
  query,
  onQueryChange,
  onStartSearch,
  onCancelSearch,
  onPick,
}: CurateAnchorChipProps) {
  const { t } = useTranslation();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;
  const { results, loading, empty } = useEntitySearch(searching ? query : '');

  if (!searching) {
    return (
      <Pressable
        onPress={onStartSearch}
        accessibilityRole="button"
        accessibilityLabel={anchor ? anchor.name : t('curate.unanchored')}
        className={`flex-row items-center gap-2.5 rounded-card bg-surface px-2.5 py-2 ${PRESS}`}
      >
        <View className="size-7 items-center justify-center rounded-small bg-surface-2">
          <Text style={{ fontSize: 14, lineHeight: 18 }}>{anchor?.emoji ?? '📍'}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('curate.about')}
          </Text>
          <Text
            numberOfLines={1}
            className={`text-small font-semibold ${anchor ? 'text-text' : 'text-text-soft'}`}
          >
            {anchor
              ? anchor.context
                ? `${anchor.name} · ${anchor.context}`
                : anchor.name
              : t('curate.unanchored')}
          </Text>
        </View>
        {/* The affordance names the action: "change" when something is pinned,
            "pick" when nothing is. */}
        <Text className="text-[11px] font-medium text-text-muted">
          {anchor ? t('curate.change') : t('curate.pick')}
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2.5 rounded-card bg-surface-2 px-2.5 py-2">
        <View className="size-7 items-center justify-center rounded-small bg-bg">
          {/* Decorative: the field's placeholder already says what this is, so
              the glyph is hidden from screen readers rather than read out. */}
          <Text style={{ fontSize: 14, lineHeight: 18 }} accessibilityElementsHidden>
            {SEARCH_GLYPH}
          </Text>
        </View>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('curate.searchPlaceholder')}
          placeholderTextColor={softColor}
          autoFocus
          autoCorrect={false}
          // 16px + an explicit line-height, like every other TextInput in the
          // app: `text-small` (13px) carries no line-height, so iOS laid the
          // field out shorter than the glyphs needed and clipped descenders.
          // 16px also avoids iOS zooming the view on focus.
          className="flex-1 p-0 text-[16px] leading-6 text-text"
        />
        {loading ? <Spinner size={14} /> : null}
        <Pressable
          onPress={onCancelSearch}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={10}
        >
          <Text className="text-[15px] font-medium text-text-muted">×</Text>
        </Pressable>
      </View>

      {results.length > 0 ? (
        // Capped height so the results never push the prose off screen — the
        // point of expanding in place is that you can still see what you wrote.
        <ScrollView className="max-h-44" keyboardShouldPersistTaps="handled">
          <View className="overflow-hidden rounded-card bg-surface">
            {results.map((hit, index) => (
              <Pressable
                key={`${hit.type}-${hit.place_id ?? hit.area_id ?? hit.name}`}
                onPress={() => onPick(hit)}
                accessibilityRole="button"
                accessibilityLabel={hit.name}
                className={`flex-row items-center gap-2.5 px-2.5 py-2.5 active:bg-surface-2 ${
                  index > 0 ? 'border-t border-bg' : ''
                }`}
              >
                <View className="size-7 items-center justify-center rounded-small bg-bg">
                  <Text style={{ fontSize: 14, lineHeight: 18 }}>{hit.emoji}</Text>
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-small font-semibold text-text">
                    {hit.name}
                  </Text>
                  {hit.subtitle ? (
                    <Text numberOfLines={1} className="text-[11px] text-text-muted">
                      {hit.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : empty ? (
        <Text className="px-1 text-[11px] text-text-soft">{t('curate.searchEmpty')}</Text>
      ) : null}
    </View>
  );
}
