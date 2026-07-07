import type { ContextMenuItem, MenuRect } from './context-menu-types';

/**
 * Pure geometry for the long-press menu — no React, no RN — so the above/below
 * flip and edge clamping are unit-testable in isolation.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  bottom: number;
}

export interface MenuPlacement {
  left: number;
  /**
   * Vertical shift applied to the lifted card (≤ 0). The menu always opens
   * directly below the card; when the card sits too low for the menu to fit, the
   * card slides up by this amount so the whole stack fits. Clamped so the card
   * never goes above the top safe area.
   */
  cardShift: number;
  /** The menu's top edge (window y) — always `shiftedCardBottom + MENU_GAP`. */
  menuTop: number;
  /**
   * Cap on the menu's height so it never runs past the bottom safe area. If the
   * menu's content is taller than this (a long menu on a short screen, with the
   * card already pinned to the top), the menu scrolls.
   */
  menuMaxHeight: number;
}

/** Gap between the lifted card and its menu (matches the mockup's 10px). */
export const MENU_GAP = 10;
/** Minimum inset the menu keeps from every screen edge. */
export const SCREEN_EDGE = 16;

// Row/list metrics used to estimate menu height before it lays out — kept in
// sync with ContextMenuList's padding (p-1 = 4px) and rows (py-2 + ~17px line).
const LIST_PADDING = 4;
const ITEM_HEIGHT = 37;
const DIVIDER_HEIGHT = 9;

/** Estimate a menu's rendered height from its items (height drives the flip). */
export function estimateMenuHeight(items: ContextMenuItem[]): number {
  const hasDivider = items.some((i) => i.destructive);
  return LIST_PADDING * 2 + items.length * ITEM_HEIGHT + (hasDivider ? DIVIDER_HEIGHT : 0);
}

/**
 * The menu always opens directly below the card (MENU_GAP). When the card sits
 * too low for the menu to fit, slide the card up just enough; clamp that slide
 * to the top safe area; and cap the menu height to the bottom safe area (it
 * scrolls if its content is still taller). The card↔menu gap is always exactly
 * MENU_GAP regardless of the (estimated) menu height.
 */
export function computeMenuPlacement(
  card: MenuRect,
  menu: Size,
  screen: Size,
  insets: Insets,
): MenuPlacement {
  const topLimit = insets.top + SCREEN_EDGE;
  const bottomLimit = screen.height - insets.bottom - SCREEN_EDGE;

  const left = Math.min(
    Math.max(SCREEN_EDGE, card.x),
    screen.width - menu.width - SCREEN_EDGE,
  );

  // The highest the card top could need to be so the menu's (estimated) bottom
  // lands on the bottom limit. Only ever move the card up, never down…
  const wantCardTop = bottomLimit - menu.height - MENU_GAP - card.height;
  // …and never above the top safe area.
  const cardTop = Math.max(topLimit, Math.min(card.y, wantCardTop));

  const menuTop = cardTop + card.height + MENU_GAP;
  const menuMaxHeight = Math.max(0, bottomLimit - menuTop);

  return { left, cardShift: cardTop - card.y, menuTop, menuMaxHeight };
}
