import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Mascot } from './mascot';
import { BOOT_WAIT } from '../theme/motion';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';

/**
 * The boot wait (ADR-056, design-system § loading states #2 — the reusable
 * loading screen, which existed on paper and had never been used).
 *
 * The splash is a fixed timeline and hands off on a timer, so a session read
 * that outlives it used to drop the user onto a home screen that quietly could
 * not fetch anything, or bounce them to login a moment later. This holds the
 * boot instead: the mascot keeps breathing, a status line appears once the wait
 * is long enough to notice, and after {@link BOOT_WAIT.giveUpMs} it becomes a
 * statement with a way out.
 *
 * "your places are safe" is the line that earns its place — a failed boot is
 * the moment a user most suspects otherwise.
 */
export function BootWait({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed((ms) => ms + BOOT_WAIT.tickMs), BOOT_WAIT.tickMs);
    return () => clearInterval(id);
  }, []);

  const stalled = elapsed >= BOOT_WAIT.giveUpMs;

  return (
    <View className="absolute inset-0 items-center justify-center gap-4 bg-bg px-8">
      <Mascot size={BOOT_WAIT.mascotSize} />
      {stalled ? (
        <>
          <Text className="text-center text-subtitle font-semibold text-text">
            {t('boot.stalled')}
          </Text>
          <Text className="text-center text-small leading-5 text-text-muted">
            {t('boot.stalledHint')}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
            className={`mt-1 rounded-card border border-surface-2 px-4 py-2.5 ${PRESS}`}
          >
            <Text className="text-small font-semibold text-text">{t('common.retry')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text className="text-title font-extrabold text-text">{t('brand.name')}</Text>
          {/* Silence is fine briefly; past a few seconds it reads as a hang. */}
          {elapsed >= BOOT_WAIT.reassureMs ? (
            <Text className="text-small text-text-muted">{t('boot.waking')}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}
