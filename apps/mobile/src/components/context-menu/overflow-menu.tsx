import { useEffect, useState, type RefObject } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ContextMenuList, MENU_WIDTH } from './context-menu-list';
import { SCREEN_EDGE } from './context-menu-placement';
import type { ContextMenuItem } from './context-menu-types';

/**
 * The menu tucks up under the trigger (overlapping its bottom edge) so it reads
 * as belonging to the button — matching kebi-context-menu-mockup.html, where the
 * ••• menu overlaps the button rather than dropping with a gap.
 */
const TRIGGER_OVERLAP = 8;

/**
 * Overflow menu (kebi-tokens-mockup.html §14 — the ••• drop-down). Same
 * `ContextMenuList` as the long-press menu, but tapped open from a button and
 * anchored under it: no lift, no blur, no scrim — just a drop-down with a
 * transparent backdrop that closes on outside tap. Pass `triggerRef` (the •••
 * wrapped in a measurable `<View collapsable={false}>`); the menu measures it on
 * open and drops from its bottom edge, right-aligned to the button.
 */

interface OverflowMenuProps {
  open: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  /** The ••• trigger, wrapped in a measurable `<View collapsable={false}>`. */
  triggerRef: RefObject<View | null>;
  /** a11y label for the dismiss backdrop (consumer passes e.g. t('common.close')). */
  closeLabel?: string;
}

interface Anchor {
  top: number;
  right: number;
}

export function OverflowMenu({ open, onClose, items, triggerRef, closeLabel }: OverflowMenuProps) {
  const { width } = useWindowDimensions();
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const node = triggerRef.current;
    if (!node) return;
    node.measureInWindow((x, y, w, h) => {
      setAnchor({
        top: y + h - TRIGGER_OVERLAP,
        right: Math.max(SCREEN_EDGE, width - (x + w)),
      });
    });
  }, [open, triggerRef, width]);

  if (!open || !anchor) return null;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      {/* Transparent backdrop — outside tap closes. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      />
      <View
        style={{ position: 'absolute', top: anchor.top, right: anchor.right, width: MENU_WIDTH }}
      >
        <ContextMenuList items={items} onSelect={onClose} />
      </View>
    </Modal>
  );
}
