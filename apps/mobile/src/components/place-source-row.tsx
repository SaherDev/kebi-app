import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { sourceLineText, type SavedPlaceView } from '@kebi-app/shared';
import { SourceGlyph } from './source-glyph';
import { Icon } from './icon';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';

/**
 * The place page's source row (kebi-place-mockup.html `.info-row`): a `--surface`
 * row showing where the place was saved from — the creator's `@handle` when the
 * origin URL carries one (else a "saved from …" label) with the source glyph. It
 * opens the origin URL when there is one (`source_ref`); manual/kebi saves have
 * no link, so the row is static and shows no chevron.
 */

export function PlaceSourceRow({ view }: { view: SavedPlaceView }) {
  const { t } = useTranslation();
  const { source, source_ref: sourceRef } = view.user_data;
  const line = sourceLineText(view.user_data);
  const text = 'handle' in line ? line.handle : t(`library.source.${line.labelKey}`);

  const content = (
    <>
      <View className="flex-row items-center gap-2.5">
        <SourceGlyph source={source} size={16} className="text-text" />
        <Text className="text-body font-medium text-text">{text}</Text>
      </View>
      {sourceRef ? <Icon name="chevron-right" size={14} className="text-text-soft" strokeWidth={2} /> : null}
    </>
  );

  if (!sourceRef) {
    return (
      <View className="flex-row items-center justify-between rounded-card bg-surface px-4 py-3.5">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={text}
      onPress={() => void Linking.openURL(sourceRef).catch(() => undefined)}
      className={`flex-row items-center justify-between rounded-card bg-surface px-4 py-3.5 ${PRESS}`}
    >
      {content}
    </Pressable>
  );
}
