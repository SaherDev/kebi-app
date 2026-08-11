/**
 * Shared types for the context-menu feature (long-press menu + ••• overflow
 * menu). Mobile-only — these never cross the Nx boundary into libs/shared.
 */

/**
 * One action row in a context menu. Generic — any card supplies its own items.
 * Non-destructive items come first; a hairline divider is inserted automatically
 * before the first `destructive` item, which renders in `--danger`. `onPress`
 * runs, then the menu closes; the consumer fires any haptic (e.g. `forget-place`)
 * from inside its own `onPress`.
 */
export interface ContextMenuItem {
  /** Emoji glyph in the leading slot (tokens §13/§14 use emoji, not icons). */
  emoji: string;
  label: string;
  /** Muted second line under the label — rendered by the ••• action sheet only. */
  sub?: string;
  /**
   * Optional grouping key for the ••• action sheet: items sharing a key render
   * in one surface card, in first-appearance order, above the destructive group.
   * Omitted items share the default group, so existing menus are unchanged.
   *
   * Exists because a public write is neither a personal action nor a destructive
   * one — it earns its own card rather than sitting in the same list as "been
   * there".
   */
  group?: string;
  destructive?: boolean;
  onPress: () => void;
}

/** On-screen rect of a measured view, in window coordinates (measureInWindow). */
export interface MenuRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
