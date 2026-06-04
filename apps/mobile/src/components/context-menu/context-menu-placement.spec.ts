import {
  computeMenuPlacement,
  estimateMenuHeight,
  MENU_GAP,
  SCREEN_EDGE,
} from './context-menu-placement';
import type { ContextMenuItem } from './context-menu-types';

const SCREEN = { width: 390, height: 844 };
const INSETS = { top: 59, bottom: 34 };
const MENU = { width: 240, height: 150 };
const TOP_LIMIT = INSETS.top + SCREEN_EDGE; // 75
const BOTTOM_LIMIT = SCREEN.height - INSETS.bottom - SCREEN_EDGE; // 794

describe('computeMenuPlacement', () => {
  it('keeps the card put and opens below when there is room', () => {
    const card = { x: 16, y: 120, width: 358, height: 56 };
    const p = computeMenuPlacement(card, MENU, SCREEN, INSETS);
    expect(p.cardShift).toBe(0);
    expect(p.menuTop).toBe(card.y + card.height + MENU_GAP);
  });

  it('slides the card up (menu stays below) when near the bottom', () => {
    const card = { x: 16, y: 740, width: 358, height: 56 };
    const p = computeMenuPlacement(card, MENU, SCREEN, INSETS);
    expect(p.cardShift).toBeLessThan(0);
    // Menu is still exactly MENU_GAP below the shifted card…
    expect(p.menuTop).toBe(card.y + p.cardShift + card.height + MENU_GAP);
    // …and its capped bottom never passes the bottom safe area.
    expect(p.menuTop + p.menuMaxHeight).toBeLessThanOrEqual(BOTTOM_LIMIT);
  });

  it('pins the card to the top and lets the menu scroll when taller than the screen', () => {
    const card = { x: 16, y: 740, width: 358, height: 56 };
    const tallMenu = { width: 240, height: 900 };
    const p = computeMenuPlacement(card, tallMenu, SCREEN, INSETS);
    expect(p.cardShift).toBe(TOP_LIMIT - card.y); // pinned to the top limit
    expect(p.menuTop).toBe(TOP_LIMIT + card.height + MENU_GAP);
    expect(p.menuMaxHeight).toBe(BOTTOM_LIMIT - p.menuTop);
    expect(p.menuMaxHeight).toBeLessThan(tallMenu.height); // → scrolls
  });

  it('left-aligns to the card but clamps to the screen edge', () => {
    const card = { x: 300, y: 120, width: 80, height: 56 };
    const p = computeMenuPlacement(card, MENU, SCREEN, INSETS);
    expect(p.left).toBe(SCREEN.width - MENU.width - SCREEN_EDGE);
  });

  it('never lets the left fall inside the edge inset', () => {
    const card = { x: 0, y: 120, width: 358, height: 56 };
    const p = computeMenuPlacement(card, MENU, SCREEN, INSETS);
    expect(p.left).toBe(SCREEN_EDGE);
  });
});

describe('estimateMenuHeight', () => {
  const item = (destructive = false): ContextMenuItem => ({
    emoji: '👍',
    label: 'x',
    destructive,
    onPress: () => undefined,
  });

  it('adds divider height only when a destructive item is present', () => {
    const withDivider = estimateMenuHeight([item(), item(true)]);
    const without = estimateMenuHeight([item(), item()]);
    expect(withDivider).toBeGreaterThan(without);
  });
});
