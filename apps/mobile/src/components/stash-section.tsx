import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SavedPlaceView } from '@kebi-app/shared';
import { StashRow } from './stash-row';
import { Icon } from './icon';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';

/**
 * The home "your stash" section (kebi-home-mockup `.group`): a single rounded
 * surface holding a title + count header, the saved-place rows (hairline-divided),
 * and a "show all" footer that opens the full library. Mirrors the `Group`
 * surface so it reads as one card — but adds the in-card header and footer the
 * mockup shows, which the plain `Group` doesn't. Hidden when there are no saves
 * (ADR-041 — no empty-state on home).
 */
interface StashSectionProps {
  views: SavedPlaceView[];
  /** Grand total of the user's saves; falls back to the loaded count. */
  total: number | null;
}

export function StashSection({ views, total }: StashSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  if (views.length === 0) return null;
  const count = total ?? views.length;

  return (
    <View className="rounded-large border border-surface-2 bg-surface p-3">
      <View className="flex-row items-center gap-2.5 px-1 pb-2">
        <Text className="text-body font-medium text-text">{t('home.yourStash')}</Text>
        <Text className="text-body text-text-muted">{count}</Text>
      </View>

      {views.map((view, i) => (
        <View key={view.user_data.user_place_id}>
          {i > 0 ? <View className="h-px bg-surface-2" /> : null}
          <StashRow view={view} />
        </View>
      ))}

      <Pressable
        onPress={() => router.push('/library')}
        accessibilityRole="button"
        accessibilityLabel={t('home.showAll')}
        className={`mt-1 flex-row items-center justify-between px-1 pt-3 ${PRESS}`}
      >
        <Text className="text-body font-medium text-text">{t('home.showAll')}</Text>
        <Icon name="chevron-right" size={14} className="text-text-soft" />
      </Pressable>
    </View>
  );
}
