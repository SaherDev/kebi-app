import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  buildDetailSegments,
  type PillTone,
  type PlaceCategory,
  type PlaceCore,
  type PlaceSource,
} from '@kebi-app/shared';
import { PRESS } from '../theme/motion';
import { Icon, type IconName } from './icon';
import { PlaceAvatar } from './place-avatar';
import { LibraryPill } from './library-pill';
import { SourceGlyph } from './source-glyph';

/**
 * Shared, presentational place card — the "circled" body of both
 * kebi-library-mockup and kebi-chat-mockup: header (avatar + name + chevron)
 * always; when expanded, the pills row, a detail line, the source line, then any
 * `children`. It takes **already-derived display props** (a SavedPlaceView and a
 * chat ConsultCandidate produce them differently), so it knows nothing about
 * where the data came from. `library-place-card` and `chat-place-card` compose
 * it; chat wraps it by passing reason + actions + swaps as `children`.
 */

export interface PlaceCardPill {
  tone: PillTone;
  /** Translated word label. Omit for a glyph-only pill (like/dislike). */
  label?: string;
  glyph?: string;
  accessibilityLabel?: string;
}

export interface PlaceCardSourceLine {
  source: PlaceSource;
  text: string;
}

/** One meta row: a leading icon + a line of text (the library card uses one row,
 *  the chat card splits into area + category·price — kebi-chat-mockup). */
export interface PlaceCardDetailRow {
  icon: IconName;
  text: string;
}

/**
 * Scale of the card. `compact` is the dense Library list; `comfortable` is the
 * larger, roomier chat recommendation (kebi-chat-mockup) — bigger text/icons/
 * avatar and more padding so the focal answer doesn't read like a list row.
 */
export type PlaceCardVariant = 'compact' | 'comfortable';

interface VariantTokens {
  pad: string;
  headerGap: string;
  avatar: 'card' | 'row' | 'lg';
  metaWrap: string;
  metaText: string;
  metaIcon: number;
  rowFirst: string;
  rowRest: string;
}

// `comfortable` mirrors kebi-chat-mockup.html `.place-card` exactly: 28px avatar,
// 16px name, 14px meta rows with 14px icons and 10px (py-2.5) row padding.
const VARIANT: Record<PlaceCardVariant, VariantTokens> = {
  compact: {
    pad: 'p-3.5',
    headerGap: 'gap-2.5',
    avatar: 'row',
    metaWrap: 'mt-2.5 gap-2',
    metaText: 'text-small leading-[15px]',
    metaIcon: 13,
    rowFirst: 'py-1',
    rowRest: 'border-t border-surface-2 pb-1 pt-2',
  },
  comfortable: {
    pad: 'p-3.5',
    headerGap: 'gap-2.5',
    avatar: 'card',
    metaWrap: 'mt-2.5 gap-2',
    metaText: 'text-[14px] leading-5',
    metaIcon: 14,
    rowFirst: 'py-2.5',
    rowRest: 'border-t border-surface-2 py-2.5',
  },
};

interface PlaceCardBodyProps {
  categories: PlaceCategory[];
  /** LLM-picked place emoji (`PlaceCore.icon`); wins over the category default. */
  icon?: string | null;
  /** Title — avatar label + header button a11y label. */
  accessibilityLabel: string;
  /** Rendered name node; must size itself `flex-1` (HighlightText / Text). */
  name: ReactNode;
  pills?: PlaceCardPill[];
  /** Meta rows under the pills — one per fact, hairline-divided (icon + text). */
  detailRows?: PlaceCardDetailRow[];
  source?: PlaceCardSourceLine;
  expanded: boolean;
  onToggle: () => void;
  /** Density/scale — defaults to the compact Library scale. */
  variant?: PlaceCardVariant;
  /** Extra content appended in the expanded body (chat: reason + actions + swaps). */
  children?: ReactNode;
}

export function PlaceCardBody({
  categories,
  icon,
  accessibilityLabel,
  name,
  pills,
  detailRows,
  source,
  expanded,
  onToggle,
  variant = 'compact',
  children,
}: PlaceCardBodyProps) {
  const v = VARIANT[variant];
  const hasRows = !!detailRows && detailRows.length > 0;
  return (
    <View className={`rounded-large bg-surface ${v.pad}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
        className={`flex-row items-center ${v.headerGap} ${PRESS}`}
      >
        <PlaceAvatar categories={categories} icon={icon} size={v.avatar} label={accessibilityLabel} />
        {name}
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="chevron-right" size={16} className="text-text-soft" />
        </View>
      </Pressable>

      {expanded ? (
        <View className={v.metaWrap}>
          {pills && pills.length > 0 ? (
            <View className="flex-row flex-wrap items-center gap-1.5">
              {pills.map((pill, i) =>
                pill.glyph ? (
                  <LibraryPill
                    key={pill.accessibilityLabel ?? i}
                    tone={pill.tone}
                    glyph={pill.glyph}
                    accessibilityLabel={pill.accessibilityLabel}
                  />
                ) : (
                  <LibraryPill key={pill.label ?? i} tone={pill.tone} label={pill.label} />
                ),
              )}
            </View>
          ) : null}

          {detailRows?.map((row, i) => (
            <View
              key={`${row.icon}-${i}`}
              className={`flex-row items-center gap-2.5 ${i === 0 ? v.rowFirst : v.rowRest}`}
            >
              <Icon name={row.icon} size={v.metaIcon} className="text-text-muted" />
              <Text className={`flex-1 text-text ${v.metaText}`} numberOfLines={1}>
                {row.text}
              </Text>
            </View>
          ))}

          {source ? (
            <View className={`flex-row items-center gap-2.5 ${hasRows ? v.rowRest : v.rowFirst}`}>
              <SourceGlyph source={source.source} />
              <Text className={`flex-1 text-text-muted ${v.metaText}`} numberOfLines={1}>
                {source.text}
              </Text>
            </View>
          ) : null}

          {children}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The category-driven detail line shared by both cards: `cuisine · facet · price
 * · area` from {@link buildDetailSegments}, with the price segment localised.
 */
export function formatDetailLine(place: PlaceCore, t: (key: string) => string): string {
  return buildDetailSegments(place)
    .map((s) => (s.kind === 'price' ? t(`library.price.${s.value}`) : s.value))
    .join(' · ');
}
