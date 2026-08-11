import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  accessibilityLine,
  buildPlaceEyebrow,
  dietaryLine,
  otherTags,
  placeDisplayName,
  placeEmoji,
  tagsOfType,
  type PlaceView,
  type SavedPlaceView,
} from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { Icon, type IconName } from '../components/icon';
import { Spinner } from '../components/spinner';
import { StatusPill } from '../components/status-pill';
import { PlaceMetaWrapper } from '../components/place-meta-wrapper';
import { PlaceTagSection } from '../components/place-tag-section';
import { PlaceSourceRow } from '../components/place-source-row';
import { PlaceClaimsSection } from '../components/place-claims-section';
import { ActionSheet } from '../components/action-sheet';
import { MapsChooserSheet } from '../components/maps-chooser-sheet';
import { usePlaceMenuItems } from '../components/use-place-menu-items';
import { usePlaceView } from '../components/use-place-view';
import { useChat } from '../components/chat-context';
import { PLACE_ORIGIN_CHAT } from '../components/use-open-chat-entity';
import { usePlaceActions } from '../components/place-actions-context';
import { useNoteSheet } from '../components/note-sheet-context';
import {
  placeCurateTarget,
  useCurateMenuItem,
  withCurateItem,
} from '../components/use-curate-menu-item';
import { buildMapsTargets } from '../lib/maps-links';
import { sharePlace } from '../lib/place-share';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';

/**
 * Outlined pill service action (kebi-place-mockup.html `.service-btn`). The
 * `primary` variant is the filled one — the save action on an unsaved place
 * (kebi-place-unsaved-options.html, option A).
 */
function ServiceButton({
  icon,
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const skin = primary ? 'border-text bg-text' : 'border-surface-2';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      // Inline opacity, not a toggled className — a conditional `opacity-*`
      // gets retained by NativeWind and sticks (see mobile motion notes).
      style={disabled ? { opacity: 0.5 } : undefined}
      className={`flex-row items-center gap-1.5 self-start rounded-full border px-3.5 py-2.5 ${skin} ${PRESS}`}
    >
      <Icon name={icon} size={13} className={primary ? 'text-bg' : 'text-text'} />
      <Text className={`text-small font-medium ${primary ? 'text-bg' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Nothing below the action row would render: no insider notes, no tags of any
 * kind, no accessibility line. True for a freshly discovered place, whose
 * catalog row carries only its category until content flows through extraction.
 */
function isBare(view: PlaceView): boolean {
  const { place } = view;
  return (
    view.claims.length === 0 &&
    tagsOfType(place, 'atmosphere').length === 0 &&
    tagsOfType(place, 'feature').length === 0 &&
    otherTags(place).length === 0 &&
    accessibilityLine(place) === null
  );
}

/**
 * Raise the chat again when a place opened *from* chat goes away. Chat is an
 * overlay, not a route, so popping this screen otherwise lands on home and the
 * conversation the user was reading is off screen. Keyed to unmount rather than
 * the back button so the iOS swipe-back gesture is covered too.
 */
function useReturnToChat() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { open } = useChat();

  useEffect(() => {
    if (from !== PLACE_ORIGIN_CHAT) return;
    // No seed — the transcript lives above the overlay, so it reopens on the
    // same conversation rather than sending anything.
    return () => open();
  }, [from, open]);
}

export default function PlaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, save, saving } = usePlaceView(id);
  useReturnToChat();

  const back = <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />;

  if (state.status !== 'ready') {
    return (
      <ScreenScaffold topBar={<TopBar left={back} />}>
        <View className="flex-1 items-center justify-center px-6 pb-24">
          {state.status === 'loading' ? (
            <Spinner />
          ) : (
            <Text className="text-body text-text-muted">
              {id ? t('place.loadFailed') : t('place.empty')}
            </Text>
          )}
        </View>
      </ScreenScaffold>
    );
  }

  return <PlaceContent view={state.view} back={back} onSave={save} saving={saving} />;
}

function PlaceContent({
  view,
  back,
  onSave,
  saving,
}: {
  view: PlaceView;
  back: React.ReactNode;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);

  const { place } = view;
  const emoji = placeEmoji(place);
  const title = placeDisplayName(view);
  const eyebrow = buildPlaceEyebrow(place);
  const dietary = dietaryLine(place);
  const access = accessibilityLine(place);
  const hasMapTargets = buildMapsTargets(place).length > 0;

  // `user_data: null` (ADR-151) means the caller never saved this place: there
  // is no `user_place_id` to PATCH or DELETE, so every user-state affordance —
  // note, approve, the meta chips, the source row, the ••• menu — is absent and
  // the save action stands in for all of it.
  const saved = view.user_data ? (view as SavedPlaceView) : null;

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={back}
          right={saved ? <SavedTopActions view={saved} onMore={() => setMenuOpen(true)} /> : null}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-6 pb-24 pt-2"
      >
        {eyebrow ? <Text className="text-small text-text-muted">{eyebrow}</Text> : null}
        {/*
          The emoji sits with the name, not on a line of its own: identity
          without vertical space, which matters most on a sparse
          just-discovered place. `placeEmoji` always resolves — the LLM icon,
          else the category map, else 📍 — so the title never starts empty.
        */}
        <Text className="text-title font-bold leading-tight text-text">
          {emoji} {title}
        </Text>

        {saved ? (
          <SavedPlaceBody view={saved} />
        ) : (
          dietary ? (
            <View className="flex-row flex-wrap items-center gap-1.5">
              <StatusPill variant="green">{dietary}</StatusPill>
            </View>
          ) : null
        )}

        {!saved ? <PlaceMetaWrapper view={view} /> : null}

        <View className="flex-row flex-wrap items-center gap-2">
          {saved ? null : (
            <ServiceButton
              icon="bookmark"
              label={saving ? t('place.saving') : t('place.save')}
              onPress={onSave}
              primary
              disabled={saving}
            />
          )}
          {hasMapTargets ? (
            <ServiceButton
              icon="pin"
              label={t('place.actions.map')}
              onPress={() => setMapsOpen(true)}
            />
          ) : null}
          <ServiceButton
            icon="share"
            label={t('place.actions.share')}
            onPress={() => void sharePlace(view)}
          />
        </View>

        {saved ? <PlaceSourceRow view={saved} /> : null}

        {/*
          A place kebi discovered this turn arrives thin: its catalog row is
          provider-built, so experiential tags and insider notes only accumulate
          later. Every section below hides itself when empty, which left the
          screen looking broken rather than new — say so instead.
        */}
        {isBare(view) ? (
          <Text className="text-[15px] leading-relaxed text-text-soft">{t('place.bare')}</Text>
        ) : null}

        <PlaceClaimsSection claims={view.claims} />

        <PlaceTagSection header={t('place.sections.atmosphere')} tags={tagsOfType(place, 'atmosphere')} />
        <PlaceTagSection header={t('place.sections.features')} tags={tagsOfType(place, 'feature')} />
        <PlaceTagSection header={t('place.sections.others')} tags={otherTags(place)} collapsible />

        {access ? (
          <View className="flex-row items-center gap-2.5 py-1">
            <Icon name="accessibility" size={13} className="text-text-muted" />
            <Text className="text-small text-text-muted">{access}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* The place page has no card to long-press, so ••• opens a bottom sheet. */}
      {saved ? (
        <PlaceMenuSheet
          view={saved}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          header={{ emoji, eyebrow: t('placeMenu.thisPlace'), title }}
        />
      ) : null}

      <MapsChooserSheet open={mapsOpen} onClose={() => setMapsOpen(false)} place={place} />
    </ScreenScaffold>
  );
}

/** Edit + ••• — saved-only, since both act on a `user_place_id`. */
function SavedTopActions({ view, onMore }: { view: SavedPlaceView; onMore: () => void }) {
  const { t } = useTranslation();
  const noteSheet = useNoteSheet();
  const { resolve } = usePlaceActions();
  const resolved: SavedPlaceView = { ...view, user_data: resolve(view).userData };

  return (
    <TopPill>
      <IconButton icon="edit" label={t('common.edit')} onPress={() => noteSheet.open(resolved)} />
      <IconButton icon="ellipsis" label={t('common.more')} onPress={onMore} />
    </TopPill>
  );
}

function PlaceMenuSheet({
  view,
  open,
  onClose,
  header,
}: {
  view: SavedPlaceView;
  open: boolean;
  onClose: () => void;
  header: { emoji: string; eyebrow: string; title: string };
}) {
  const { t } = useTranslation();
  const placeItems = usePlaceMenuItems(view);
  // Door a (kebi-curate-options.html §1): the insider write hangs off the •••
  // sheet, anchored to this place. Null for everyone else, so the row is simply
  // absent rather than disabled. Not added to usePlaceMenuItems itself — that
  // builder also feeds the library card long-press, which is not a door.
  const curateItem = useCurateMenuItem(useMemo(() => placeCurateTarget(view.place), [view.place]));
  const items = useMemo(() => withCurateItem(placeItems, curateItem), [placeItems, curateItem]);
  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      header={header}
      items={items}
      closeLabel={t('common.close')}
    />
  );
}

/**
 * Everything driven by the caller's save: the dietary/approve row, the meta
 * chips and the note. Split out so the unsaved screen never mounts the hooks
 * these need (`usePlaceActions`, `useNoteSheet`) for a save that doesn't exist.
 */
function SavedPlaceBody({ view }: { view: SavedPlaceView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { resolve, update } = usePlaceActions();
  const noteSheet = useNoteSheet();
  const { userData, removed } = resolve(view);
  const resolvedView: SavedPlaceView = { ...view, user_data: userData };
  const dietary = dietaryLine(view.place);
  const note = userData.note;

  // Forgotten here → leave the page; the library row is already hidden globally.
  useEffect(() => {
    if (removed) router.back();
  }, [removed, router]);

  return (
    <>
      {dietary || !userData.approved ? (
        <View className="flex-row flex-wrap items-center gap-1.5">
          {dietary ? <StatusPill variant="green">{dietary}</StatusPill> : null}
          {!userData.approved ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('place.approve')}
              onPress={() =>
                void update(view, { approved: true }, { emoji: '👍', text: t('placeMenu.toast.approved') })
              }
            >
              <StatusPill variant="amber">{t('place.approve')}</StatusPill>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <PlaceMetaWrapper view={resolvedView} />

      {note ? (
        <Pressable
          onPress={() => noteSheet.open(resolvedView)}
          accessibilityRole="button"
          accessibilityLabel={t('placeMenu.editNote')}
        >
          <Text className="text-[17px] leading-[26px] tracking-[-0.01em] text-text">{note}</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => noteSheet.open(resolvedView)}
          accessibilityRole="button"
          accessibilityLabel={t('placeMenu.addNote')}
        >
          <Text className="text-[15px] leading-relaxed text-text-soft">{t('place.addNote')}</Text>
        </Pressable>
      )}
    </>
  );
}
