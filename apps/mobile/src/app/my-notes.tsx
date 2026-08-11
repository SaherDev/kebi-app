import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { TopPill } from '../components/top-pill';
import { IconButton } from '../components/icon-button';
import { Spinner } from '../components/spinner';
import { ContextMenuTrigger } from '../components/context-menu/context-menu-trigger';
import { useCurateSheet } from '../components/curate-sheet-context';
import { useMyClaims } from '../components/use-my-claims';
import { useRequireCapability } from '../capabilities';
import type { ClaimGroup, KnowledgeClaim } from '../api/models/knowledge';
import { useTranslation } from '../i18n/context';

/**
 * "What you've added" — every claim the caller wrote, grouped by what it is
 * about (kebi-curate-options.html §5, page a).
 *
 * This screen is **load-bearing**: the write flow has no receipt and no review
 * step, so it is the only surface where an insider can ever see what their prose
 * became. It renders in the same quote-rail vocabulary the place page uses, so
 * your notes look here exactly as strangers see them there — the honest version
 * of a receipt.
 *
 * A reading surface: no counts, no status, no metadata on the rows. The one
 * action is long-press → remove, with an undo window.
 *
 * Route-gated as well as hidden: settings only shows the row for an insider, but
 * a deep link, the share extension, or a back-stack entry from before a
 * revocation all reach a route without passing the row we hid.
 */
export default function MyNotesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const allowed = useRequireCapability('curate');
  const { state, retract } = useMyClaims();
  const curateSheet = useCurateSheet();

  const back = <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />;

  // Renders nothing while the capability is unresolved or denied — the hook
  // navigates away once the answer is authoritative.
  if (!allowed) return <ScreenScaffold topBar={<TopBar left={back} />}>{null}</ScreenScaffold>;

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={back}
          right={
            <TopPill>
              {/* The page you visit to see your work is also somewhere you can
                  write from — unanchored, so the subject is picked in the sheet. */}
              <IconButton
                icon="edit"
                label={t('curate.menuLabel')}
                onPress={() => curateSheet.open({ view: null })}
              />
            </TopPill>
          }
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-6 pb-28 pt-2"
      >
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('settings.knowledge')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('myClaims.hero')}</Text>
          {state.status === 'ready' && state.total > 0 ? (
            <Text className="text-small text-text-muted">
              {t('myClaims.subtitle', {
                notes: String(state.total),
                places: String(state.groups.length),
              })}
            </Text>
          ) : null}
        </View>

        <Body state={state} onRetract={retract} />
      </ScrollView>
    </ScreenScaffold>
  );
}

function Body({
  state,
  onRetract,
}: {
  state: ReturnType<typeof useMyClaims>['state'];
  onRetract: (claim: KnowledgeClaim) => void;
}) {
  const { t } = useTranslation();

  if (state.status === 'loading') {
    return (
      <View className="items-center py-16">
        <Spinner />
      </View>
    );
  }
  if (state.status === 'failed') {
    return <Text className="text-body text-text-muted">{t('myClaims.loadFailed')}</Text>;
  }
  if (state.groups.length === 0) {
    return <Text className="text-body text-text-muted">{t('myClaims.empty')}</Text>;
  }

  return (
    <View className="gap-5">
      {state.groups.map((group) => (
        <AnchorGroup key={group.key} group={group} onRetract={onRetract} />
      ))}
    </View>
  );
}

/** One anchor and everything written about it — the group header is the subject. */
function AnchorGroup({
  group,
  onRetract,
}: {
  group: ClaimGroup;
  onRetract: (claim: KnowledgeClaim) => void;
}) {
  return (
    <View className="gap-2.5">
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">
        {group.anchor.emoji} {group.anchor.name}
      </Text>
      <View className="gap-3.5">
        {group.claims.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} onRetract={onRetract} />
        ))}
      </View>
    </View>
  );
}

/**
 * One note. Long-press lifts it into a one-item menu — the same gesture the
 * library cards use, so removing a note is the gesture the app already taught.
 */
function ClaimRow({
  claim,
  onRetract,
}: {
  claim: KnowledgeClaim;
  onRetract: (claim: KnowledgeClaim) => void;
}) {
  const { t } = useTranslation();
  const items = useMemo(
    () => [
      {
        emoji: '🗑️',
        label: t('myClaims.remove'),
        destructive: true,
        onPress: () => onRetract(claim),
      },
    ],
    [t, claim, onRetract],
  );

  return (
    <ContextMenuTrigger
      items={items}
      accessibilityLabel={claim.claim}
      renderCard={() => (
        // The place page's quote rail, exactly: a thin rule and the prose.
        <View className="flex-row gap-3 bg-bg">
          <View className="w-[2px] self-stretch rounded-full bg-surface-2" />
          <Text className="flex-1 text-body text-text">{claim.claim}</Text>
        </View>
      )}
    />
  );
}
