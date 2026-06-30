import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useToast } from './toast-context';
import { useTranslation } from '../i18n/context';

/**
 * The shared "you hit a limit" prompt. Shows a danger toast carrying a **see
 * plans** action that opens the plans screen, where the user can switch tier.
 * One surface for all three ADR-112 enforcement outcomes (save button, extract,
 * chat daily quota) so the upgrade affordance is identical everywhere.
 */
export function useUpgradeToast(): (text: string) => void {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();

  return useCallback(
    (text: string) => {
      toast.show({
        tone: 'danger',
        icon: 'alert',
        text,
        action: { label: t('plans.upgradeAction'), onPress: () => router.push('/plans') },
      });
    },
    [router, toast, t],
  );
}
