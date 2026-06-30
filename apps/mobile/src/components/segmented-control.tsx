import { View, Text, Pressable } from 'react-native';
import { PRESS } from '../theme/motion';
import { Icon, type IconName } from './icon';

/**
 * A pill-track segmented control (kebi-settings-mockup.html `.theme-segment`).
 * Generic over its options — the appearance row is the first consumer. The
 * active segment lifts to a `--text` fill with `--bg` label; inactive segments
 * are muted on the shared `--bg` track. Presentational: pass already-translated
 * labels; selection state and persistence live with the caller.
 */
export interface SegmentOption<T extends string> {
  value: T;
  /** Already-translated label. */
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View className="flex-row rounded-full bg-bg p-[3px]">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2 ${PRESS} ${
              active ? 'bg-text' : 'bg-transparent'
            }`}
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                size={13}
                className={active ? 'text-bg' : 'text-text-muted'}
              />
            ) : null}
            <Text
              className={`text-small font-medium ${active ? 'text-bg' : 'text-text-muted'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
