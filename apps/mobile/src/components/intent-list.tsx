import { Text, View } from 'react-native';
import type { IntentItem } from '@kebi-app/shared';
import { IntentRow } from './intent-row';
import { ErrorRow } from './error-row';
import { useTranslation } from '../i18n/context';

/**
 * The home "what you wanted" section (kebi-home-mockup `.history-list`): an
 * eyebrow over the recent recalled intents, newest-first. Hidden entirely when
 * there's nothing to recall — no empty-state copy on the home screen (ADR-041).
 */
interface IntentListProps {
  intents: IntentItem[];
  onSelect: (text: string) => void;
  /** The read failed and we have nothing — the section says so itself. */
  error?: boolean;
  onRetry?: () => void;
}

export function IntentList({ intents, onSelect, error, onRetry }: IntentListProps) {
  const { t } = useTranslation();

  // Hidden when there is nothing to recall, but *not* when we failed to find
  // out (ADR-056) — those are different facts and used to look identical.
  if (intents.length === 0 && error) {
    return (
      <View className="gap-3">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('home.whatYouWanted')}
        </Text>
        <ErrorRow
          text={t('home.recallFailed')}
          actionLabel={t('common.retry')}
          onAction={() => onRetry?.()}
        />
      </View>
    );
  }

  if (intents.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {t('home.whatYouWanted')}
      </Text>
      <View className="gap-4">
        {intents.map((intent) => (
          <IntentRow
            key={intent.id}
            text={intent.text}
            createdAt={intent.created_at}
            onPress={onSelect}
          />
        ))}
      </View>
    </View>
  );
}
