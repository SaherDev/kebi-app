import { Text, View } from 'react-native';
import { AddRow, GhostPreview } from './ghost-preview';
import { useTranslation } from '../i18n/context';

/**
 * Library cold empty (ADR-056, kebi-library-states-options.html §3b). The hero
 * answers itself in the slot that will read "7 places, saved up", two ghost
 * cards show what lands there, and the add row is the last card in the list.
 *
 * No mascot: it keeps its two jobs, the splash and the blocking load, and a
 * third dilutes it. No filled button either — the pulsing bookmark ring in the
 * top bar still teaches the control that outlives this screen, and the screen's
 * one primary stays unspent.
 */
export function LibraryEmpty({ onSave }: { onSave: () => void }) {
  const { t } = useTranslation();

  const ghosts = [
    { emoji: '\u{1F35C}', name: t('home.ghost.first'), meta: t('home.ghost.firstMeta') },
    { emoji: '☕', name: t('home.ghost.second'), meta: t('home.ghost.secondMeta') },
  ];

  return (
    <View className="flex-1 gap-2 px-6 pt-2">
      <View className="pb-1">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('library.eyebrow')}
        </Text>
        <Text className="mt-1 text-[34px] font-bold leading-tight text-text">
          {t('library.empty.hero')}
          <Text className="text-text-muted">{t('library.empty.heroSuffix')}</Text>
        </Text>
      </View>

      <GhostPreview>
        <View className="gap-2">
          {ghosts.map((ghost) => (
            <View key={ghost.name} className="rounded-large bg-surface p-3">
              <View className="flex-row items-center gap-2.5">
                <View className="size-[34px] items-center justify-center rounded-small bg-bg">
                  <Text className="text-[16px]">{ghost.emoji}</Text>
                </View>
                <Text className="flex-1 text-body font-semibold text-text" numberOfLines={1}>
                  {ghost.name}
                </Text>
              </View>
              <Text className="mt-2 text-small text-text-muted">{ghost.meta}</Text>
            </View>
          ))}
        </View>
      </GhostPreview>

      <AddRow
        boxed
        label={t('library.empty.save')}
        sublabel={t('library.empty.saveSub')}
        onPress={onSave}
      />
    </View>
  );
}
