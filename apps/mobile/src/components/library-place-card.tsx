import { useRouter } from 'expo-router';
import {
  derivePills,
  placeDisplayName,
  sourceLineText,
  type SavedPlaceView,
} from '@kebi-app/shared';
import { HighlightText } from './highlight-text';
import { PlaceCardBody, formatDetailLine, type PlaceCardPill } from './place-card-body';
import { ContextMenuTrigger } from './context-menu/context-menu-trigger';
import { usePlaceMenuItems } from './use-place-menu-items';
import { usePlaceDetail } from './place-detail-context';
import { usePlaceActions } from './place-actions-context';
import { useTranslation } from '../i18n/context';

/**
 * The Library's saved-place row (kebi-library-mockup.html `.place-card`). Tapping
 * the row opens the full place detail page (path A — hands the view to the
 * place-detail context, navigates to `/place`). Long-press lifts the shared
 * action menu ({@link usePlaceMenuItems} → global {@link usePlaceActions}); the
 * same actions power the place page. The card renders its effective state via
 * `resolve` (optimistic pills) and hides itself once the place is forgotten.
 */

interface LibraryPlaceCardProps {
  view: SavedPlaceView;
  /** Active search term (pre-lowercased) — highlights matches in the title. */
  highlight?: string;
}

export function LibraryPlaceCard({ view, highlight }: LibraryPlaceCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const placeDetail = usePlaceDetail();
  const { resolve } = usePlaceActions();
  const items = usePlaceMenuItems(view);

  const { userData, removed } = resolve(view);
  if (removed) return null; // optimistically gone after a forget

  const { place } = view;
  const title = placeDisplayName(view);
  const pills: PlaceCardPill[] = derivePills(userData).map((p) => {
    const label = t(`library.pill.${p.kind}`);
    return p.glyph
      ? { tone: p.tone, glyph: p.glyph, accessibilityLabel: label }
      : { tone: p.tone, label };
  });
  const source = sourceLineText(userData);
  const sourceText = 'handle' in source ? source.handle : t(`library.source.${source.labelKey}`);

  const openPlace = () => {
    placeDetail.set(view);
    router.push('/place');
  };

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
          expanded={false}
          onToggle={openPlace}
        />
      )}
    />
  );
}
