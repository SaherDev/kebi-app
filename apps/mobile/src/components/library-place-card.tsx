import { useState } from 'react';
import {
  derivePills,
  placeDisplayName,
  sourceLineText,
  type SavedPlaceView,
} from '@kebi-app/shared';
import { HighlightText } from './highlight-text';
import { PlaceCardBody, formatDetailLine, type PlaceCardPill } from './place-card-body';
import { ContextMenuTrigger } from './context-menu/context-menu-trigger';
import { useLibraryMenuItems } from './use-library-menu-items';
import { useTranslation } from '../i18n/context';
import type { LibraryActions } from './use-library-actions';

/**
 * The Library's rich saved-place card (kebi-library-mockup.html `.place-card`).
 * Derives its display props from a {@link SavedPlaceView} — pills from the saved
 * state, the detail line from the place, the source line + handle from the save
 * — and renders them through the shared {@link PlaceCardBody}. The chat
 * recommendation card composes the same body from a candidate instead. Tap the
 * row toggles expand; long-press lifts the action menu (wired via {@link LibraryActions}).
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
  const pills: PlaceCardPill[] = derivePills(userData).map((p) => {
    const label = t(`library.pill.${p.kind}`);
    return p.glyph
      ? { tone: p.tone, glyph: p.glyph, accessibilityLabel: label }
      : { tone: p.tone, label };
  });
  const source = sourceLineText(userData);
  const sourceText = 'handle' in source ? source.handle : t(`library.source.${source.labelKey}`);

  return (
    <ContextMenuTrigger
      items={items}
      accessibilityLabel={title}
      renderCard={() => (
        <PlaceCardBody
          categories={place.categories}
          accessibilityLabel={title}
          name={
            <HighlightText
              text={title}
              query={highlight}
              className="flex-1 text-body font-semibold text-text"
              numberOfLines={1}
            />
          }
          pills={pills}
          detailRows={(() => {
            const line = formatDetailLine(place, t);
            return line ? [{ icon: 'pin' as const, text: line }] : undefined;
          })()}
          source={{ source: userData.source, text: sourceText }}
          expanded={expanded}
          onToggle={() => setExpanded((e) => !e)}
        />
      )}
    />
  );
}
