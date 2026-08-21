import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './icon';
import { PRESS, STATES } from '../theme/motion';

/**
 * The cold-empty treatment (design-system § empty states, ADR-056): the real
 * content's own rows, faded, so an empty screen shows the shape of what will
 * land there instead of describing it.
 *
 * Pair with {@link AddRow}, which is the action — the last row of the list
 * rather than a button. A filled primary button is wrong here: it's the
 * heaviest ink in the system on the emptiest screen, and it spends the screen's
 * one primary on a screen whose top bar usually already carries the save
 * trigger.
 *
 * Not for a filtered no-match (echo the query and offer the undo instead), and
 * not for a surface with no in-app action — there, say it in one line.
 */
export function GhostPreview({ children }: { children: ReactNode }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity: STATES.ghostOpacity }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}

/**
 * The empty state's action, drawn as the next row in the list: a dashed avatar
 * where an emoji will go, the label where a name will go. Tapping it does what
 * the screen's real trigger does (open the save sheet, the curate sheet).
 */
interface AddRowProps {
  label: string;
  sublabel?: string;
  onPress: () => void;
  /** Glyph in the dashed avatar slot — `plus` unless the act is writing. */
  icon?: 'plus' | 'edit';
  /** Draw the row's own dashed card. Off when it sits inside an existing group. */
  boxed?: boolean;
}

export function AddRow({ label, sublabel, onPress, icon = 'plus', boxed = false }: AddRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 ${
        boxed ? 'rounded-large border border-dashed border-surface-2 p-3' : 'py-2.5'
      } ${PRESS}`}
    >
      <View className="size-9 items-center justify-center rounded-small border border-dashed border-text-soft">
        <Icon name={icon} size={16} className="text-text-muted" />
      </View>
      <View className="flex-1">
        <Text className="text-body font-semibold text-text-muted">{label}</Text>
        {sublabel ? <Text className="mt-0.5 text-small text-text-soft">{sublabel}</Text> : null}
      </View>
    </Pressable>
  );
}
