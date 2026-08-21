import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { triggerHaptic } from '../lib/haptics';
import { useTranslation } from '../i18n/context';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { ErrorRow } from './error-row';

/**
 * A confirm bottom sheet for a single weighty action — "nuke everything?",
 * "log out?" (kebi-settings-mockup.html `.sheet`). Wraps {@link BottomSheet}
 * (grabber, scrim, spring-up, drag/backdrop dismiss) with a body line and two
 * buttons: an outlined cancel ("nvm") and a filled confirm. Defaults the confirm
 * to the danger variant since both consumers are destructive; fires the
 * confirm-delete haptic on a danger confirm.
 *
 * `onConfirm` may return a promise. While it runs the sheet **holds** — confirm
 * shows a spinner and a present-tense verb, cancel dims, and the sheet can't be
 * dismissed — and if it rejects the sheet stays open and says so (ADR-056).
 *
 * That matters most for "nuke my data": closing the instant you tap it makes a
 * slow wipe indistinguishable from a no-op, lets a second tap fire a second
 * wipe, and reports the failure as a toast on a screen that still shows
 * everything. With a destructive action, the state of the data is the only
 * thing the sentence needs to carry.
 */
interface ConfirmSheetProps {
  open: boolean;
  title: string;
  body: string;
  /** Already-translated confirm label, e.g. "do it" / "log out". */
  confirmLabel: string;
  /** Present-tense label while the action runs, e.g. "nuking". */
  busyLabel?: string;
  /** Shown in place of the body when the action failed, e.g. "nothing was deleted". */
  failedText?: string;
  /** Resolve to close; reject (or resolve false) to keep the sheet open. */
  onConfirm: () => void | Promise<unknown>;
  onClose: () => void;
  /** Confirm button variant — danger (default) or primary. */
  tone?: 'danger' | 'primary';
}

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  busyLabel,
  failedText,
  onConfirm,
  onClose,
  tone = 'danger',
}: ConfirmSheetProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Fresh each time it opens — a previous failure must not greet the next tap.
  useEffect(() => {
    if (open) {
      setBusy(false);
      setFailed(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (busy) return;
    if (tone === 'danger') triggerHaptic('confirm-delete');
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    setBusy(true);
    setFailed(false);
    result
      .then(() => setBusy(false))
      .catch(() => {
        setBusy(false);
        setFailed(true);
      });
  };

  return (
    <BottomSheet open={open} title={title} onClose={busy ? undefined : onClose}>
      {failed && failedText ? (
        <ErrorRow text={t('common.failedGeneric')} detail={failedText} />
      ) : (
        <Text className="text-body leading-6 text-text-muted">{body}</Text>
      )}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={t('settings.cancel')}
            variant="outlined"
            onPress={onClose}
            disabled={busy}
          />
        </View>
        <View className="flex-1">
          <Button
            label={busy && busyLabel ? busyLabel : failed ? t('common.retry') : confirmLabel}
            variant={tone}
            busy={busy}
            onPress={handleConfirm}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
