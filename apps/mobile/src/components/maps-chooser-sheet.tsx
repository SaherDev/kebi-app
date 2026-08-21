import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { PlaceCore } from '@kebi-app/shared';
import { BottomSheet } from './bottom-sheet';
import { Icon } from './icon';
import { buildMapsTargets } from '../lib/maps-links';
import { useTranslation } from '../i18n/context';

/**
 * "Show on …" chooser — design A (kebi-place-maps-chooser-options.html):
 * a grouped list on the shared {@link BottomSheet}, one row per available maps app
 * (text + chevron — no brand glyphs). Tapping a row shows the place in that app
 * (a pin / place card, not directions) and dismisses. Only rows whose URL can be
 * built are shown (Google is the durable, exact one; Apple/Waze need coords).
 * Triggered by the place page's "map" button.
 *
 * Two states beyond the list (ADR-056). A row is only drawn if the OS says it
 * can open that URL — offering an app that isn't installed produces a tap that
 * silently does nothing, which is the same defect as a button that can't work.
 * And a place with nothing to open at all (no coords, no address, no provider
 * id — a place kebi just discovered) gets one line rather than an empty box.
 * The place page hides the trigger in that case, so this is a safety net, not a
 * screen anyone should reach.
 */

interface MapsChooserSheetProps {
  open: boolean;
  onClose: () => void;
  place: PlaceCore;
}

export function MapsChooserSheet({ open, onClose, place }: MapsChooserSheetProps) {
  const { t } = useTranslation();
  const targets = buildMapsTargets(place);
  type MapsApp = (typeof targets)[number]['app'];
  /** Apps the OS confirms it can open. `null` until the check resolves. */
  const [openable, setOpenable] = useState<MapsApp[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void Promise.all(
      targets.map((target) =>
        Linking.canOpenURL(target.url)
          .then((can) => (can ? target.app : null))
          // A provider that refuses to answer is assumed present: hiding a row
          // that would have worked is worse than showing one that might not.
          .catch(() => target.app),
      ),
    ).then((apps) => {
      if (live) setOpenable(apps.filter((app): app is MapsApp => app !== null));
    });
    return () => {
      live = false;
    };
    // `targets` is derived from `place` and stable for a given sheet opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place]);

  // Before the check resolves, show everything — the list is instant and a
  // flash of rows disappearing is worse than a tap that no-ops.
  const shown = openable === null ? targets : targets.filter((t2) => openable.includes(t2.app));

  return (
    <BottomSheet open={open} title={t('place.maps.title')} onClose={onClose}>
      {shown.length === 0 ? (
        <Text className="px-1 pb-1 text-body leading-6 text-text-muted">
          {t('place.maps.nothingToOpen')}
        </Text>
      ) : (
      <View className="overflow-hidden rounded-large bg-surface">
        {shown.map((target, index) => {
          const label = t(`place.maps.${target.app}`);
          return (
            <Pressable
              key={target.app}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                void Linking.openURL(target.url).catch(() => undefined);
                onClose();
              }}
              className={`flex-row items-center px-3.5 py-3.5 active:bg-surface-2 ${
                index > 0 ? 'border-t border-bg' : ''
              }`}
            >
              <Text className="flex-1 text-body font-medium text-text">{label}</Text>
              <Icon name="chevron-right" size={15} className="text-text-soft" strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
      )}
    </BottomSheet>
  );
}
