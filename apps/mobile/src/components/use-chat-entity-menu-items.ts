import { useMemo } from 'react';
import type { ChatEntity } from '@kebi-app/shared';
import { useTranslation } from '../i18n/context';
import { chatEntityCurateTarget, useCurateMenuItem } from './use-curate-menu-item';
import type { ContextMenuItem } from './context-menu/context-menu-types';

/**
 * The long-press menu for a chat rail chip — door d
 * (kebi-curate-options.html §4).
 *
 * Deliberately short. The chip is a third the width of a library card, so a tall
 * menu hanging off it reads top-heavy, and the place actions (looks right / i
 * like / been there / forget) all need a **saved** place, which a chat entity
 * usually is not — and none of them mean anything for an area. That leaves two
 * rows that work in every state:
 *
 *   open · (divider) · add what you know
 *
 * "add what you know" is the only item that applies to every case — saved venue,
 * unsaved venue, area — because curating needs no save and no ownership. Which
 * is a good sign it belongs here.
 *
 * NOTE: the full menu shape is still an open question in the plan (whether to
 * mirror the place-card menu when the entity happens to be saved). This is the
 * minimal shape that is correct in every state; growing it is additive.
 */
export function useChatEntityMenuItems(
  entity: ChatEntity,
  onOpen: (entity: ChatEntity) => void,
): ContextMenuItem[] {
  const { t } = useTranslation();
  const curateItem = useCurateMenuItem(
    useMemo(() => chatEntityCurateTarget(entity), [entity]),
  );

  return useMemo(() => {
    const items: ContextMenuItem[] = [
      { emoji: '📄', label: t('chat.entityMenu.open'), onPress: () => onOpen(entity) },
    ];
    // Absent for a non-insider, so the menu is just "open" — still useful, and
    // the same gesture works for everyone rather than doing nothing for most.
    if (curateItem) items.push(curateItem);
    return items;
  }, [t, onOpen, entity, curateItem]);
}
