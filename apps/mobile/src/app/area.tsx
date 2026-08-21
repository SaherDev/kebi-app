import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CHAT_ENTITY_FALLBACK_ICON, type AreaSection as AreaSectionContract } from '@kebi-app/shared';
import type { AreaScreenView } from '../api/models/area';
import { isSectionEmpty } from '../api/models/area';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { TopPill } from '../components/top-pill';
import { ActionSheet } from '../components/action-sheet';
import { areaCurateTarget, useCurateMenuItem } from '../components/use-curate-menu-item';
import { Chip } from '../components/chip';
import { AreaSkeleton } from '../components/area-skeleton';
import { ErrorRow } from '../components/error-row';
import { AreaChildRow, AreaPlaceRow } from '../components/area-row';
import { useAreaView } from '../components/use-area-view';
import { useChat } from '../components/chat-context';
import { PLACE_ORIGIN_CHAT } from '../components/use-open-chat-entity';
import { areaIdFromUri } from '../lib/area-link';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';

/**
 * The area screen behind every area link (kebi-area-mockup.html and
 * kebi-area-country-mockup.html, locked; kebi ADR-153).
 *
 * Read-only by design: an area has no save, so no TopPill, and no ask bar, no
 * distance chip, no "nearby" siblings, and no suggestions section — the locked
 * screen is the summary kebi wrote, what the area is good for, and the places
 * you already have there. Navigation is therefore breadcrumb-up or row-down
 * only, which is why both have to be obviously tappable.
 *
 * The response splits in two (ADR-153): a **global half** generated once and
 * shared by every caller (name, level, icon, summary, best-for, breadcrumb) and
 * a **personal half** computed per request (`saved_count`, the body section).
 * Nothing on this screen is generated per user.
 *
 * The rail chip that opens it says nothing about opening a list rather than a
 * place card (kebi-chat-area-chip-options.html option 1), so the arrival has to
 * say it instead: the breadcrumb, the level chip, and a body of rows that each
 * carry their own chevron are what establish "this contains things".
 */

/**
 * Levels kebi labels an area with, and which have a translation. An unknown
 * level prints kebi's own word rather than a missing-key marker — the server
 * may add one before this build ships.
 */
const TRANSLATED_LEVELS = ['country', 'region', 'city', 'neighbourhood'] as const;

function useLevelLabel(level: string | null): string | null {
  const { t } = useTranslation();
  if (!level) return null;
  return (TRANSLATED_LEVELS as readonly string[]).includes(level)
    ? t(`area.level.${level}`)
    : level;
}

/**
 * Raise the chat again when an area opened *from* chat goes away — chat is an
 * overlay, not a route, so popping otherwise lands on home with the
 * conversation off screen. The marker is one hop only: a row tapped from here
 * pushes without it, so backing out of a drill-down retraces the chain instead
 * of jumping into chat from the middle of it.
 */
function useReturnToChat() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { open } = useChat();

  useEffect(() => {
    if (from !== PLACE_ORIGIN_CHAT) return;
    return () => open();
  }, [from, open]);
}

export default function AreaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // `name` and `icon` are what the link that opened this screen already knew
  // (ADR-056): the title is real from the first frame, so the wait confirms the
  // tap instead of showing an anonymous grey screen — and a failure can name
  // the area it failed to open.
  const { id, name, icon } = useLocalSearchParams<{ id?: string; name?: string; icon?: string }>();
  const { state, retry } = useAreaView(id);
  useReturnToChat();

  const back = <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />;

  if (state.status === 'loading') {
    return (
      <ScreenScaffold topBar={<TopBar left={back} />}>
        <AreaSkeleton name={name} icon={icon} />
      </ScreenScaffold>
    );
  }

  if (state.status === 'failed') {
    // A link that can never resolve is not a network failure — it gets an
    // explanation and a way out, never a retry that is guaranteed to fail.
    if (!state.retryable) {
      return (
        <ScreenScaffold topBar={<TopBar left={back} />}>
          <View className="flex-1 items-center justify-center gap-3 px-8 pb-24">
            <Text className="text-[28px]">{'\u{1F5FA}\u{FE0F}'}</Text>
            <Text className="text-center text-body font-semibold text-text">
              {t('area.gone')}
            </Text>
            <Text className="text-center text-small leading-5 text-text-muted">
              {t('area.goneHint')}
            </Text>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              className={`mt-1 rounded-card border border-surface-2 px-4 py-2.5 ${PRESS}`}
            >
              <Text className="text-small font-semibold text-text">{t('common.back')}</Text>
            </Pressable>
          </View>
        </ScreenScaffold>
      );
    }

    return (
      <ScreenScaffold topBar={<TopBar left={back} />}>
        <AreaSkeleton
          name={name}
          icon={icon}
          frozen
          error={
            <ErrorRow
              text={name ? t('area.loadFailedNamed', { name }) : t('area.loadFailed')}
              detail={t('home.nothingLost')}
              actionLabel={t('common.retry')}
              onAction={retry}
            />
          }
        />
      </ScreenScaffold>
    );
  }

  return <AreaContent view={state.view} back={back} />;
}

/**
 * The area's ••• sheet — door b (kebi-curate-options.html §1). Same component
 * and vocabulary as the place page's, filled differently.
 *
 * It renders **only for insiders**, unlike the place page's, and that is
 * deliberate: an area has none of the place actions (looks right / i like / been
 * there / forget), so for everyone else the sheet would open empty. The button
 * appears with the permission and disappears without it — no dead end to
 * explain. It grows into a normal sheet the day areas get actions of their own.
 */
function AreaTopActions({ view }: { view: AreaScreenView }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const curateItem = useCurateMenuItem(
    useMemo(
      () =>
        areaCurateTarget({
          uri: view.uri,
          name: view.name,
          icon: view.icon,
          context: view.breadcrumb.at(-1)?.name,
        }),
      [view],
    ),
  );

  if (!curateItem) return null;

  return (
    <>
      <TopPill>
        <IconButton icon="ellipsis" label={t('common.more')} onPress={() => setMenuOpen(true)} />
      </TopPill>
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={{
          emoji: view.icon ?? CHAT_ENTITY_FALLBACK_ICON.area,
          eyebrow: t('curate.thisArea'),
          title: view.name,
        }}
        items={[curateItem]}
        closeLabel={t('common.close')}
      />
    </>
  );
}

function AreaContent({ view, back }: { view: AreaScreenView; back: React.ReactNode }) {
  const { t } = useTranslation();
  const level = useLevelLabel(view.level);

  return (
    <ScreenScaffold topBar={<TopBar left={back} right={<AreaTopActions view={view} />} />}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-6 pb-24 pt-2"
      >
        <Breadcrumb view={view} />

        {/*
          The emoji sits with the name, exactly as on the place screen — the two
          kinds are one species, and an unprofiled area still has a glyph.
        */}
        <Text className="text-title font-bold leading-tight text-text">
          {view.icon ?? CHAT_ENTITY_FALLBACK_ICON.area} {view.name}
        </Text>

        <MetaWrapper level={level} savedCount={view.saved_count} />

        {/*
          The summary is the hero: never clamped, never behind a "more" — it is
          the one thing on the screen only kebi could have written. It is absent
          on a thin first open, and `useAreaView` refetches once for it.
        */}
        {view.summary ? (
          <Text className="text-[17px] leading-[26px] tracking-[-0.01em] text-text">
            {view.summary}
          </Text>
        ) : null}

        {view.best_for.length > 0 ? (
          <View className="gap-2.5">
            <Text className="text-eyebrow font-semibold uppercase text-text-soft">
              {t('area.bestFor')}
            </Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {view.best_for.map((chip, i) => (
                <Chip key={`${chip.text}-${i}`} emoji={chip.icon ?? undefined}>
                  {chip.text}
                </Chip>
              ))}
            </View>
          </View>
        ) : null}

        <Body section={view.section} areaName={view.name} />
      </ScrollView>
    </ScreenScaffold>
  );
}

/**
 * The ancestors, outermost first — `indonesia › bali` above Canggu. Each crumb
 * is its own area and opens its own screen; with siblings dropped from the
 * locked design this is the screen's only way up.
 */
function Breadcrumb({ view }: { view: AreaScreenView }) {
  const router = useRouter();
  if (view.breadcrumb.length === 0) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {view.breadcrumb.map((crumb, i) => {
        const id = areaIdFromUri(crumb.uri);
        return (
          <Fragment key={crumb.key}>
            {i > 0 ? <Text className="text-small text-text-soft">›</Text> : null}
            <Pressable
              disabled={!id}
              accessibilityRole="button"
              accessibilityLabel={crumb.name}
              onPress={() => id && router.push({ pathname: '/area', params: { id } })}
              className={id ? PRESS : undefined}
            >
              <Text className="text-small text-text-muted underline">{crumb.name}</Text>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/**
 * The at-a-glance chips (kebi-area-mockup.html `.meta-wrapper`): what kind of
 * area this is, and how much of the caller's own stash is inside it. The saved
 * chip is hidden at 0 — "0 saved" is a fact nobody needs, and its absence is
 * what makes the count mean something when it does appear. The whole wrapper
 * hides when it has nothing, the same rule the place screen's follows.
 */
function MetaWrapper({ level, savedCount }: { level: string | null; savedCount: number }) {
  const { t } = useTranslation();
  if (!level && savedCount <= 0) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-1.5 rounded-large bg-surface p-2.5">
      {level ? <MetaChip>{level}</MetaChip> : null}
      {savedCount > 0 ? <MetaChip>{t('area.saved', { count: savedCount })}</MetaChip> : null}
    </View>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-bg px-2.5 py-1.5">
      <Text className="text-small font-medium text-text">{children}</Text>
    </View>
  );
}

/**
 * The one body section, whose kind the server chooses: `saved` is the caller's
 * own footprint, `worth_knowing` is kebi's notable children when they have none
 * here. Both draw the same rows — child areas above the leaf, venues at it —
 * so the section header is the only thing that changes.
 */
function Body({ section, areaName }: { section: AreaSectionContract | null; areaName: string }) {
  const { t } = useTranslation();

  // An area you have nothing in keeps the section and says so (ADR-056) —
  // rendering nothing made "you've saved nothing here" and "the list failed to
  // load" the same screen. No ghost rows and no add row: this screen is
  // read-only, so there is no action to point them at.
  if (!section || isSectionEmpty(section)) {
    return (
      <View className="gap-2.5">
        <Text className="text-eyebrow font-semibold uppercase text-text-soft">
          {t('area.sections.savedPlaces')}
        </Text>
        <Text className="text-body leading-6 text-text-muted">
          {t('area.nothingHere', { name: areaName })}
        </Text>
      </View>
    );
  }

  const header =
    section.kind === 'worth_knowing'
      ? t('area.sections.worthKnowing')
      : section.areas.length > 0
        ? t('area.sections.saved')
        : t('area.sections.savedPlaces');

  return (
    <View className="gap-2.5">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">{header}</Text>
      <View>
        {/*
          Both lists can be non-empty at once: a save whose place carries no geo
          deeper than this level shows as a venue row at a wide level.
        */}
        {section.areas.map((area) => (
          <AreaChildRow key={area.key} area={area} />
        ))}
        {section.places.map((place) => (
          <AreaPlaceRow key={place.id} place={place} />
        ))}
      </View>
    </View>
  );
}
