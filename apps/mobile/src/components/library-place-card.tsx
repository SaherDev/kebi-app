import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  buildDetailSegments,
  derivePills,
  placeDisplayName,
  sourceLineText,
  type SavedPlaceView,
} from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { Icon } from './icon';
import { PlaceAvatar } from './place-avatar';
import { LibraryPill } from './library-pill';
import { HighlightText } from './highlight-text';
import { SourceGlyph } from './source-glyph';
import { ContextMenuTrigger } from './context-menu/context-menu-trigger';
import { useLibraryMenuItems } from './use-library-menu-items';
import { useTranslation } from '../i18n/context';
import type { LibraryActions } from './use-library-actions';

/**
 * The Library's rich saved-place card (kebi-library-mockup.html `.place-card`).
 * Collapsed it is `[avatar] [title] [chevron]`; expanded it reveals the status
 * pills, a category-driven detail line (`cuisine · facet · price · area`) and a
 * source line (`@handle` or "saved from …"). Tap the row toggles expand;
 * long-press lifts the action menu (wired to PATCH/DELETE via {@link LibraryActions}).
 */

interface LibraryPlaceCardProps {
  view: SavedPlaceView;
  /** First card opens expanded (mockup), the rest collapsed. */
  initiallyExpanded?: boolean;
  actions: LibraryActions;
  /** Active search term (pre-lowercased) — highlights matches in the title. */
  highlight?: string;
}

export function LibraryPlaceCard({
  view,
  initiallyExpanded = false,
  actions,
  highlight,
}: LibraryPlaceCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const items = useLibraryMenuItems(view, actions);

  const { place, user_data: userData } = view;
  const title = placeDisplayName(view);
  const pills = derivePills(userData);
  const detail = buildDetailSegments(place)
    .map((s) => (s.kind === 'price' ? t(`library.price.${s.value}`) : s.value))
    .join(' · ');
  const source = sourceLineText(userData);
  const sourceText = 'handle' in source ? source.handle : t(`library.source.${source.labelKey}`);

  return (
    <ContextMenuTrigger
      items={items}
      accessibilityLabel={title}
      renderCard={() => (
        <View className="rounded-large bg-surface p-3.5">
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            accessibilityRole="button"
            accessibilityLabel={title}
            className={`flex-row items-center gap-2.5 ${PRESS}`}
          >
            <PlaceAvatar categories={place.categories} size="row" label={title} />
            <HighlightText
              text={title}
              query={highlight}
              className="flex-1 text-body font-semibold text-text"
              numberOfLines={1}
            />
            <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
              <Icon name="chevron-right" size={16} className="text-text-soft" />
            </View>
          </Pressable>

          {expanded ? (
            <View className="mt-2.5 gap-2">
              <View className="flex-row flex-wrap items-center gap-1.5">
                {pills.map((pill) => {
                  const text = t(`library.pill.${pill.kind}`);
                  return pill.glyph ? (
                    <LibraryPill
                      key={pill.kind}
                      tone={pill.tone}
                      glyph={pill.glyph}
                      accessibilityLabel={text}
                    />
                  ) : (
                    <LibraryPill key={pill.kind} tone={pill.tone} label={text} />
                  );
                })}
              </View>
              {detail ? (
                <View className="flex-row items-center gap-2.5 py-1">
                  <Icon name="pin" size={13} className="text-text-muted" />
                  <Text
                    className="flex-1 text-small leading-[15px] text-text"
                    numberOfLines={1}
                  >
                    {detail}
                  </Text>
                </View>
              ) : null}
              <View
                className={`flex-row items-center gap-2.5 ${
                  detail ? 'border-t border-surface-2 pb-1 pt-2' : 'py-1'
                }`}
              >
                <SourceGlyph source={userData.source} />
                <Text
                  className="flex-1 text-small leading-[15px] text-text-muted"
                  numberOfLines={1}
                >
                  {sourceText}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      )}
    />
  );
}
