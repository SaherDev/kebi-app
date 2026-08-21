import { Pressable, Text, View } from 'react-native';
import { PRESS } from '../theme/motion';

/**
 * The app's one recoverable-error line (design-system § error handling,
 * ADR-056): a coloured dot, one sentence, one action. It sits above whatever
 * failed — a frozen skeleton, a group's rows, a chat turn — never in place of
 * the whole screen.
 *
 * Two tones, and the difference is not severity but truth:
 * - `danger` — we asked and didn't get it. Retrying may work.
 * - `warn` — nothing broke (offline, a plan limit). Often nothing to retry.
 *
 * `--danger` is a dot colour here, not a body-text colour: the sentence is
 * ordinary muted text so an error reads like a remark, not an alarm. Callers
 * supply already-localised copy; this component holds no strings.
 */

interface ErrorRowProps {
  /** One sentence, lowercase, in the app's voice. Say what failed. */
  text: string;
  /** Optional second clause — reassurance, or what happens next. */
  detail?: string;
  tone?: 'danger' | 'warn';
  /** Omit both to render a statement with no way forward (a 404, a limit). */
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorRow({ text, detail, tone = 'danger', actionLabel, onAction }: ErrorRowProps) {
  const showAction = actionLabel != null && onAction != null;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-2.5 px-1 py-2"
    >
      <View
        className={`size-1.5 rounded-full ${tone === 'warn' ? 'bg-warn' : 'bg-danger'}`}
      />
      <View className="flex-1">
        <Text className="text-small text-text-muted">
          <Text className="font-semibold text-text">{text}</Text>
          {detail ? ` ${detail}` : ''}
        </Text>
      </View>
      {showAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          className={`px-1 ${PRESS}`}
        >
          <Text className="text-small font-semibold text-text">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
