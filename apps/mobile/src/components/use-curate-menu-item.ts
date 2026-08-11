import { useMemo } from 'react';
import { useTranslation } from '../i18n/context';
import { useCan } from '../capabilities';
import { useCurateSheet, type CurateTarget } from './curate-sheet-context';
import type { ContextMenuItem } from './context-menu/context-menu-types';

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
