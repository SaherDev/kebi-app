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
