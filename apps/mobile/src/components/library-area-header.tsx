import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CHAT_ENTITY_FALLBACK_ICON } from '@kebi-app/shared';
import { areaIdFromUri } from '../lib/area-link';
import { Icon } from './icon';
import { useTranslation } from '../i18n/context';
import { PRESS } from '../theme/motion';
import type { LibraryGroup } from '../lib/library-groups';

/**
 * A Library section header (kebi-library-filter-options.html §5, v1): icon,
 * area name, count, hairline rule — no fill, so the header stays subordinate
 * to the cards under it rather than reading as another card.
 *
 * The whole row is a **link, not a filter**. Tapping opens the area screen
 * (ADR-153) — the same screen a chat area link opens, reached the same way
 * (`areaIdFromUri` off the pre-composed `uri`), so there is one code path and a
 * header tap and a chat tap can never diverge. No `from=chat` marker: this is
 * a route-stack push, not chat surfacing a detail screen.
 *
 * The `elsewhere` bucket passes `tappable: false` — it is a data-completeness
 * gap with no area behind it, so it renders as a plain label with no chevron
 * and nothing to press.
 */

interface LibraryAreaHeaderProps {
  group: LibraryGroup;
  tappable: boolean;
  /** The area the device is in — badged, so the order explains itself. */
  here?: boolean;
  /** Rendered for the `elsewhere` bucket, which has no area name of its own. */
  label?: string;
}

export function LibraryAreaHeader({ group, tappable, here, label }: LibraryAreaHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = label ?? group.name;
  // A folded group can land on an ancestor kebi sent no handle for, so there is
  // no pre-composed `uri` and nothing to open. Never rebuild one from the key
  // (ADR-153) — just stop claiming the row is a link.
  const areaId = group.uri ? areaIdFromUri(group.uri) : null;
  const opens = tappable && areaId !== null;

  const body = (
    <View className="flex-row items-center gap-2 border-b border-surface-2 px-1 pb-1.5 pt-1">
      {tappable ? (
        <Text className="text-[13px] leading-none">
          {group.icon ?? CHAT_ENTITY_FALLBACK_ICON.area}
        </Text>
      ) : null}
      <Text
        className={`text-body font-bold ${tappable ? 'text-text' : 'text-text-muted'}`}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text className="text-small text-text-soft">{group.count}</Text>
      {here ? (
        <View className="rounded-full bg-pill-green-bg px-2 py-0.5">
          <Text className="text-eyebrow font-semibold text-success">{t('library.here')}</Text>
        </View>
      ) : null}
      {opens ? (
        <View className="ms-auto">
          <Icon name="chevron-right" size={11} className="text-text-soft" />
        </View>
      ) : null}
    </View>
  );

  if (!opens) return body;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/area', params: { id: areaId } })}
      accessibilityRole="link"
      accessibilityLabel={name}
      className={PRESS}
    >
      {body}
    </Pressable>
  );
}
