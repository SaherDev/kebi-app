import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { PlaceCore } from '@kebi-app/shared';
import { BottomSheet } from './bottom-sheet';
import { Icon } from './icon';
import { buildMapsTargets } from '../lib/maps-links';
import { useTranslation } from '../i18n/context';

/**
 * "Open directions in …" chooser — design A (kebi-place-maps-chooser-options.html):
 * a grouped list on the shared {@link BottomSheet}, one row per available maps app
 * (text + chevron — no brand glyphs). Tapping a row opens that app's directions
 * deep link and dismisses. Only rows whose URL can be built are shown (Google is
 * the durable, exact one; Apple/Waze need coords). Triggered by the place page's
 * "directions" button.
 */

interface MapsChooserSheetProps {
  open: boolean;
  onClose: () => void;
  place: PlaceCore;
}

export function MapsChooserSheet({ open, onClose, place }: MapsChooserSheetProps) {
  const { t } = useTranslation();
  const targets = buildMapsTargets(place);

  return (
    <BottomSheet open={open} title={t('place.maps.title')} onClose={onClose}>
      <View className="overflow-hidden rounded-large bg-surface">
        {targets.map((target, index) => {
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
    </BottomSheet>
  );
}
