import { Text, View } from 'react-native';
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

export function HomeHero({ greeting }: HomeHeroProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {t('home.eyebrow')}
      </Text>
      <Text className="text-hero font-bold text-text">{greeting ?? ' '}</Text>
    </View>
  );
}
