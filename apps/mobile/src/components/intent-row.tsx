import { Pressable, Text } from 'react-native';
import { formatRelativeTime } from '../lib/format-relative-time';
import { PRESS } from '../theme/motion';

/**
 * One "what you wanted" row (kebi-home-mockup `.history-entry`): the past query
 * in quotes with a relative timestamp under it. Tapping re-submits the verbatim
 * `text` to the chat (the parent threads it to `useChat().open(text)`). The time
 * is rendered client-side from the raw ISO instant — only the client knows the
 * user's timezone (api-contract.md §GET /v1/user/intents).
 */
interface IntentRowProps {
  text: string;
  /** Raw ISO-8601 instant from the server. */
  createdAt: string;
  onPress: (text: string) => void;
}

export function IntentRow({ text, createdAt, onPress }: IntentRowProps) {
  return (
    <Pressable
      onPress={() => onPress(text)}
      accessibilityRole="button"
      accessibilityLabel={text}
      className={`gap-0.5 ${PRESS}`}
    >
      <Text className="text-[17px] leading-snug text-text">{`"${text}"`}</Text>
      <Text className="text-[12px] text-text-soft">{formatRelativeTime(createdAt)}</Text>
    </Pressable>
  );
}
