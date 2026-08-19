import { memo, useMemo } from 'react';
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
import {
  placeCurateTarget,
  useCurateMenuItem,
  withCurateItem,
} from './use-curate-menu-item';
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

function LibraryPlaceCardRow({ view, highlight }: LibraryPlaceCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const placeDetail = usePlaceDetail();
  const { resolve } = usePlaceActions();
  const placeItems = usePlaceMenuItems(view);
  // The library card is a door too: same actions, same anchor as the place
  // page's ••• sheet. Null for a non-insider, so the row is simply absent.
  const curateItem = useCurateMenuItem(useMemo(() => placeCurateTarget(view.place), [view.place]));
  const items = useMemo(
    () => withCurateItem(placeItems, curateItem),
    [placeItems, curateItem],
  );

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
    // Seed so the screen paints instantly; `id` is what it refreshes from.
    placeDetail.set(view);
    router.push({ pathname: '/place', params: { id: place.id ?? '' } });
  };

  return (
    <ContextMenuTrigger
      items={items}
      accessibilityLabel={title}
      renderCard={() => (
        <PlaceCardBody
          categories={place.categories}
          icon={place.icon}
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

/**
 * Memoised, because the Library re-renders its whole list several times on a
 * cold open — rows arrive, then the device's country resolves and re-orders the
 * sections — and a row is not cheap: two menu builders, a pill derivation and a
 * context-menu trigger each. Without this the re-orders rebuild every mounted
 * row and the screen visibly stutters before settling.
 *
 * The optimistic state a row draws comes from context ({@link usePlaceActions}),
 * which memoisation does not block, so a forget still hides the row instantly.
 */
export const LibraryPlaceCard = memo(LibraryPlaceCardRow);
