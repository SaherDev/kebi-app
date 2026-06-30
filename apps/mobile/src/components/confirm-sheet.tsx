import { View, Text } from 'react-native';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';

/**
 * A confirm bottom sheet for a single weighty action — "nuke everything?",
 * "log out?" (kebi-settings-mockup.html `.sheet`). Wraps {@link BottomSheet}
 * (grabber, scrim, spring-up, drag/backdrop dismiss) with a body line and two
 * buttons: an outlined cancel ("nvm") and a filled confirm. Defaults the confirm
 * to the danger variant since both consumers are destructive; fires the
 * confirm-delete haptic on a danger confirm.
 *
 * Presentational: `onConfirm` runs the action; the caller closes the sheet.
 */
interface ConfirmSheetProps {
  open: boolean;
  title: string;
  body: string;
  /** Already-translated confirm label, e.g. "do it" / "log out". */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Confirm button variant — danger (default) or primary. */
  tone?: 'danger' | 'primary';
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  tone = 'danger',
}: ConfirmSheetProps) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    if (tone === 'danger') triggerHaptic('confirm-delete');
    onConfirm();
  };

  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      <Text className="text-body leading-6 text-text-muted">{body}</Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label={t('settings.cancel')} variant="outlined" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button label={confirmLabel} variant={tone} onPress={handleConfirm} />
        </View>
      </View>
    </BottomSheet>
  );
}
