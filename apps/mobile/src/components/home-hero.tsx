import { Text, View } from 'react-native';
import { Skeleton } from './skeleton';
import { useTranslation } from '../i18n/context';

/**
 * The home hero (kebi-home-mockup `.turn.kebi` + `.hero`): a `kebi` eyebrow over
 * the context-aware greeting, shown as plain text. (A `TypewriterText` keystroke
 * reveal exists and can drop back in here, but the typing felt off, so it's
 * plain for now.) Renders a blank line while the greeting loads so the layout
 * doesn't jump when it arrives.
 */
interface HomeHeroProps {
  greeting: string | null;
}

/** Two hero lines' worth of shimmer, in the greeting's own type size. */
const HERO_LINE_HEIGHT = 26;

export function HomeHero({ greeting }: HomeHeroProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      {/* The eyebrow is static text — it never waits (ADR-056). */}
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {t('home.eyebrow')}
      </Text>
      {greeting == null ? (
        // The greeting is one of the three things home is guaranteed to get
        // (the endpoint fails open with fallback chips), so it may promise.
        <View className="gap-2">
          <Skeleton height={HERO_LINE_HEIGHT} width="82%" radius="small" />
          <Skeleton height={HERO_LINE_HEIGHT} width="54%" radius="small" />
        </View>
      ) : (
        <Text className="text-hero font-bold text-text">{greeting}</Text>
      )}
    </View>
  );
}
