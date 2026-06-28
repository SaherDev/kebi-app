import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CATEGORY_EMOJI,
  CATEGORY_EMOJI_FALLBACK,
  accessibilityLine,
  buildPlaceEyebrow,
  dietaryLine,
  otherTags,
  placeDisplayName,
  tagsOfType,
  type SavedPlaceView,
} from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { Icon, type IconName } from '../components/icon';
import { StatusPill } from '../components/status-pill';
import { PlaceMetaWrapper } from '../components/place-meta-wrapper';
import { PlaceTagSection } from '../components/place-tag-section';
import { PlaceSourceRow } from '../components/place-source-row';
import { ActionSheet } from '../components/action-sheet';
import { MapsChooserSheet } from '../components/maps-chooser-sheet';
import { usePlaceMenuItems } from '../components/use-place-menu-items';
import { usePlaceDetail } from '../components/place-detail-context';
import { usePlaceActions } from '../components/place-actions-context';
import { useNoteSheet } from '../components/note-sheet-context';
import { buildMapsTargets } from '../lib/maps-links';
import { sharePlace } from '../lib/place-share';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';

/** Outlined pill service action (kebi-place-mockup.html `.service-btn`). */
function ServiceButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-1.5 self-start rounded-full border border-surface-2 px-3.5 py-2.5 ${PRESS}`}
    >
      <Icon name={icon} size={13} className="text-text" />
      <Text className="text-small font-medium text-text">{label}</Text>
    </Pressable>
  );
}

export default function PlaceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { view } = usePlaceDetail();

  const back = <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />;

  // Path A: the place is set by the list surface before navigating. With no
  // selection (e.g. a cold start onto /place) there's nothing to show — a
  // GET-by-id fetch is path B, out of scope.
  if (!view) {
    return (
      <ScreenScaffold topBar={<TopBar left={back} />}>
        <View className="flex-1 items-center justify-center px-6 pb-24">
          <Text className="text-body text-text-muted">{t('place.empty')}</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return <PlaceContent view={view} back={back} />;
}

function PlaceContent({ view, back }: { view: SavedPlaceView; back: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);

  // Effective user-state: the live server value plus any optimistic override from
  // a menu action (like/visited/approve), and whether it's been forgotten.
  const { resolve, update } = usePlaceActions();
  const noteSheet = useNoteSheet();
  const { userData, removed } = resolve(view);
  const resolvedView: SavedPlaceView = { ...view, user_data: userData };
  const items = usePlaceMenuItems(view);

  // Forgotten here → leave the page; the library row is already hidden globally.
  useEffect(() => {
    if (removed) router.back();
  }, [removed, router]);

  const { place } = view;
  const emoji = CATEGORY_EMOJI[place.categories[0]] ?? CATEGORY_EMOJI_FALLBACK;
  const title = placeDisplayName(view);
  const eyebrow = buildPlaceEyebrow(place);
  const dietary = dietaryLine(place);
  const note = userData.note;
  const access = accessibilityLine(place);
  const hasDirections = buildMapsTargets(place).length > 0;

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={back}
          right={
            <TopPill>
              <IconButton
                icon="edit"
                label={t('common.edit')}
                onPress={() => noteSheet.open(resolvedView)}
              />
              <IconButton icon="ellipsis" label={t('common.more')} onPress={() => setMenuOpen(true)} />
            </TopPill>
          }
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-6 pb-24 pt-2"
      >
        {eyebrow ? <Text className="text-small text-text-muted">{eyebrow}</Text> : null}
        <Text className="text-title font-bold leading-tight text-text">{title}</Text>
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

        <View className="flex-row flex-wrap items-center gap-2">
          {hasDirections ? (
            <ServiceButton
              icon="navigation"
              label={t('place.actions.directions')}
              onPress={() => setMapsOpen(true)}
            />
          ) : null}
          <ServiceButton
            icon="share"
            label={t('place.actions.share')}
            onPress={() => void sharePlace(resolvedView)}
          />
        </View>

        <PlaceSourceRow view={resolvedView} />

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
      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={{ emoji, eyebrow: t('placeMenu.thisPlace'), title }}
        items={items}
        closeLabel={t('common.close')}
      />

      <MapsChooserSheet open={mapsOpen} onClose={() => setMapsOpen(false)} place={place} />
    </ScreenScaffold>
  );
}
