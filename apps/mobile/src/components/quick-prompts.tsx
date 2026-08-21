import { View } from 'react-native';
import type { HomeChip } from '@kebi-app/shared';
import { QuickPromptChip } from './quick-prompt-chip';
import { Skeleton } from './skeleton';

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

/** Chip skeleton widths (px) — three, in the rhythm of a real chip row. */
const CHIP_SKELETON_WIDTHS = [104, 142, 88];
/** Chip line height (px) — the 17px prompt text plus its dashed underline. */
const CHIP_HEIGHT = 17;

export function QuickPrompts({ chips, onSelect }: QuickPromptsProps) {
  // Chips always arrive (the hook falls back to generic ones on a transport
  // failure), so an empty list means "still loading" and may promise (ADR-056).
  if (chips.length === 0) {
    return (
      <View className="flex-row flex-wrap gap-x-4 gap-y-2">
        {CHIP_SKELETON_WIDTHS.map((width) => (
          <Skeleton key={width} height={CHIP_HEIGHT} width={width} radius="full" />
        ))}
      </View>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-2">
      {chips.map((chip, i) => (
        <QuickPromptChip key={`${chip.text}-${i}`} text={chip.text} onPress={onSelect} />
      ))}
    </View>
  );
}
