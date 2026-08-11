import { useMemo } from 'react';
import {
  CHAT_ENTITY_FALLBACK_ICON,
  placeEmoji,
  type ChatEntity,
  type PlaceCore,
} from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import { useCan } from '../capabilities';
import { areaIdFromUri } from '../lib/area-link';
import { useCurateSheet, type CurateTarget } from './curate-sheet-context';
import type { ContextMenuItem } from './context-menu/context-menu-types';

/**
 * The curate target for a place — one builder, so every door anchors a place the
 * same way and renders the same chip.
 *
 * `id` is nullable on PlaceCore (a place kebi surfaced but never catalogued). No
 * id means **no anchor** rather than a wrong one: the note still sends, and kebi
 * resolves the subject from the prose as it does for any unanchored write.
 */
export function placeCurateTarget(place: PlaceCore): CurateTarget {
  return {
    anchor: place.id ? { place_id: place.id } : undefined,
    view: {
      emoji: placeEmoji(place),
      name: place.place_name,
      context: place.location?.city ?? undefined,
    },
  };
}

/**
 * The curate target for an area.
 *
 * `uri` is the source, never the area's `key`: the key is a raw geo path
 * (`id/bali/canggu`) that no endpoint accepts, while the anchor wants the opaque
 * token the link carries. Reading the wrong one lands every area note unanchored
 * — the exact trap kebi ADR-153/160 call out — so the extraction lives here once
 * rather than at each door.
 */
export function areaCurateTarget(area: {
  uri: string;
  name: string;
  icon: string | null;
  context?: string;
}): CurateTarget {
  const areaId = areaIdFromUri(area.uri);
  return {
    anchor: areaId ? { area_id: areaId } : undefined,
    view: {
      emoji: area.icon ?? CHAT_ENTITY_FALLBACK_ICON.area,
      name: area.name,
      context: area.context,
    },
  };
}

/**
 * The curate target for an entity kebi named in a chat answer — the only door
 * where the anchor needs **no lookup at all**, because the turn already resolved
 * it (ADR-136).
 *
 * The two kinds identify differently and that is the whole subtlety: a venue's
 * `key` **is** `places.id`, so it anchors directly, while an area's `key` is the
 * raw geo path and the usable id is the token on its `uri`. Same asymmetry
 * `useOpenChatEntity` already navigates by.
 */
export function chatEntityCurateTarget(entity: ChatEntity): CurateTarget {
  const view = {
    emoji: entity.icon ?? CHAT_ENTITY_FALLBACK_ICON[entity.kind],
    name: entity.name,
  };
  if (entity.kind === 'venue') {
    return { anchor: entity.key ? { place_id: entity.key } : undefined, view };
  }
  const areaId = areaIdFromUri(entity.uri);
  return { anchor: areaId ? { area_id: areaId } : undefined, view };
}

/**
 * Slot the curate row into a menu **before the destructive items**.
 *
 * Appending would put a public write after "forget this place" — and the
 * long-press menu draws its divider before the first destructive item, so the
 * row would land on the wrong side of it. The ••• sheet keeps it on its own card
 * via the item's `group`; this keeps the flat menu's order right.
 */
export function withCurateItem(
  items: ContextMenuItem[],
  curate: ContextMenuItem | null,
): ContextMenuItem[] {
  if (!curate) return items;
  const firstDestructive = items.findIndex((i) => i.destructive);
  if (firstDestructive === -1) return [...items, curate];
  return [...items.slice(0, firstDestructive), curate, ...items.slice(firstDestructive)];
}

/**
 * The "add what you know" row, for any menu that should offer it — the place
 * ••• sheet today, the area sheet and the chat entity menu next. Returns `null`
 * for a non-insider, so a caller spreads it in and the row simply is not there:
 *
 * ```ts
 * const curate = useCurateMenuItem(target);
 * const items = [...placeItems, ...(curate ? [curate] : [])];
 * ```
 *
 * The permission check lives **here**, once, rather than at each call site —
 * that is what makes a revoked grant remove every door at the same instant
 * (see `capabilities/`). It is display-only: the routes are enforced
 * server-side by CuratorGuard and again by kebi.
 *
 * Carries its own `group`, so the ••• sheet renders it on its own card between
 * the personal actions and the destructive one. A public write is neither.
 */
export function useCurateMenuItem(target: CurateTarget): ContextMenuItem | null {
  const { t } = useTranslation();
  const canCurate = useCan('curate');
  const { open } = useCurateSheet();

  return useMemo<ContextMenuItem | null>(() => {
    if (!canCurate) return null;
    return {
      emoji: '✍️',
      label: t('curate.menuLabel'),
      sub: t('curate.menuSub'),
      group: 'curate',
      onPress: () => open(target),
    };
  }, [canCurate, t, open, target]);
}
