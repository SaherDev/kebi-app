import { Pressable, Text } from 'react-native';
import { PRESS } from '../theme/motion';

/**
 * A home quick-prompt (kebi-home-mockup `.quick-prompt`): a dashed-underline text
 * button, NOT the pill `Chip`. Its `text` is both the label and the intent — a
 * tap re-submits it as a first chat message (the parent threads it to
 * `useChat().open(text)`). The dashed underline sits on the wrapping `Pressable`
 * so it tracks the text width.
 */
interface QuickPromptChipProps {
  text: string;
  onPress: (text: string) => void;
}

export function QuickPromptChip({ text, onPress }: QuickPromptChipProps) {
  return (
    <Pressable
      onPress={() => onPress(text)}
      accessibilityRole="button"
      accessibilityLabel={text}
      className={`self-start border-b border-dashed border-text-soft pb-px ${PRESS}`}
    >
      <Text className="text-[17px] text-text">{text}</Text>
    </Pressable>
  );
}
