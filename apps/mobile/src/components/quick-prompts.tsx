import { View } from 'react-native';
import type { HomeChip } from '@kebi-app/shared';
import { QuickPromptChip } from './quick-prompt-chip';

/**
 * The home quick-prompt row (kebi-home-mockup `.quick-prompts`): the greeting's
 * suggestion chips, wrapping. Hidden when there are none (the hook always
 * supplies fallback chips on a transport failure, so this is effectively only
 * empty mid-load).
 */
interface QuickPromptsProps {
  chips: HomeChip[];
  onSelect: (text: string) => void;
}

export function QuickPrompts({ chips, onSelect }: QuickPromptsProps) {
  if (chips.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-2">
      {chips.map((chip, i) => (
        <QuickPromptChip key={`${chip.text}-${i}`} text={chip.text} onPress={onSelect} />
      ))}
    </View>
  );
}
