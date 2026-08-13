import { useCallback, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { PLAN_TIERS } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Icon, type IconName } from '../components/icon';
import { Group } from '../components/group';
import { SettingsRow } from '../components/settings-row';
import { StatusPill } from '../components/status-pill';
import { ProfileAvatar } from '../components/profile-avatar';
import { SegmentedControl } from '../components/segmented-control';
import { ConfirmSheet } from '../components/confirm-sheet';
import { useProfile } from '../components/use-profile';
import { useCurateSheet } from '../components/curate-sheet-context';
import { Can } from '../capabilities';
import { useThemePreference } from '../components/use-theme-preference';
import { useToast } from '../components/toast-context';
import { useApiClient } from '../api/hooks';
import { deleteUserData } from '../api/user-data';
import { getUserSettings } from '../api/user-settings';
import type { UserSettings } from '../api/models/user-settings';
import { useTranslation } from '../i18n/context';
import { useAuth } from '../auth/auth-context';
import type { ThemeChoice } from '../lib/theme-preference';

/**
 * Settings — "you, basically" (kebi-settings-mockup.html). Profile (name/email/
 * plan), subscription, appearance (light/dark/system), data, and account. The
 * profile read comes from the gateway-local /user/profile (the client is
 * otherwise blind to identity). The name is no longer edited here: it is
 * `call_me` on the about-you screen, so there is one name with one editor
 * (ADR-054) — the header falls back to the account name until one is set.
 * billing is rendered but inert, export is intentionally absent, and there's no
 * plan status pill (no subscription-status data exists yet).
 */

const THEME_OPTIONS: { value: ThemeChoice; labelKey: string; icon: IconName }[] = [
  { value: 'light', labelKey: 'settings.themeLight', icon: 'sun' },
  { value: 'dark', labelKey: 'settings.themeDark', icon: 'moon' },
  { value: 'system', labelKey: 'settings.themeSystem', icon: 'monitor' },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, refetch } = useProfile();
  const curateSheet = useCurateSheet();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  // Re-read the profile when settings regains focus (e.g. returning from the
  // plans screen after a switch) so the plan row reflects the new tier.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const { choice, setChoice } = useThemePreference();
  const toast = useToast();
  const client = useApiClient();

  const [nukeOpen, setNukeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const anySheetOpen = nukeOpen || logoutOpen;

  // The two "what kebi knows" rows summarise these; re-read on focus so a save
  // on either screen is reflected the moment you come back.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const next = await getUserSettings(client);
          if (!cancelled) setSettings(next);
        } catch {
          // Non-fatal: the rows fall back to "not set" rather than blocking
          // the whole screen on a summary.
          if (!cancelled) setSettings(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [client]),
  );

  // One name: what kebi calls you, falling back to the account name.
  const name = settings?.about_me?.call_me ?? profile?.name ?? '';
  const email = profile?.email ?? '';
  const planMeta = profile ? PLAN_TIERS[profile.plan] : null;
  const aboutMeSet = settings?.about_me != null && !settings.about_me.isEmpty;
  // A seeded profile is not "set" — kebi ignores its modes until a human picks
  // (kebi ADR-155), so the row would otherwise claim a choice nobody made.
  const movementSet = settings?.movement_profile?.isChosen ?? false;
  const version = Constants.expoConfig?.version ?? '';

  const handleNuke = async () => {
    setNukeOpen(false);
    try {
      await deleteUserData(client);
      toast.show({ tone: 'success', icon: 'trash', text: t('settings.toast.nuked') });
    } catch {
      toast.show({ tone: 'danger', icon: 'alert', text: t('settings.toast.nukeFailed') });
    }
  };

  const handleLogout = () => {
    setLogoutOpen(false);
    void signOut();
  };

  return (
    <ScreenScaffold
      // Hide the FAB while a sheet covers the screen (design-system: the AI
      // button is hidden behind a sheet).
      showFab={!anySheetOpen}
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
        />
      }
    >
      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-28 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow + hero */}
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('settings.eyebrow')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('settings.hero')}</Text>
        </View>

        {/* Profile block */}
        <View className="flex-row items-center gap-3.5">
          <ProfileAvatar name={name} email={email} />
          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-subtitle font-bold text-text">
                {name || t('settings.addName')}
              </Text>
              {/*
                The whole "you're an insider" surface, said once. No explainer
                line: every door already says "everyone will see it" at the
                moment you're about to write, which is where that warning does
                work. Identity here, consequence there.
              */}
              <Can do="curate">
                <StatusPill variant="green">{t('settings.insider')}</StatusPill>
              </Can>
            </View>
            {email ? <Text className="text-small text-text-muted">{email}</Text> : null}
          </View>
        </View>

        {/* What kebi knows — the two things it reasons with (ADR-054). */}
        <Group eyebrow={t('settings.whatKebiKnows')}>
          <SettingsRow
            emoji="👋"
            label={t('settings.aboutYou')}
            sublabel={t('settings.aboutYouSub')}
            onPress={() => router.push('/about-you')}
            trailing={
              <View className="flex-row items-center gap-2">
                <Text className="text-small text-text-muted">
                  {aboutMeSet ? t('settings.isSet') : t('settings.notSet')}
                </Text>
                <Icon name="chevron-right" size={14} className="text-text-soft" />
              </View>
            }
          />
          <SettingsRow
            emoji="🛵"
            label={t('settings.gettingAround')}
            sublabel={t('settings.gettingAroundSub')}
            onPress={() => router.push('/getting-around')}
            trailing={
              <View className="flex-row items-center gap-2">
                <Text className="text-small text-text-muted">
                  {movementSet ? t('settings.isSet') : t('settings.notSet')}
                </Text>
                <Icon name="chevron-right" size={14} className="text-text-soft" />
              </View>
            }
          />
        </Group>

        {/*
          Knowledge — insider-only (kebi-curate-options.html §1, door c). Sits
          *below* "what kebi knows" so an insider's settings screen opens exactly
          like everyone else's: the group is an addition, never a reordering.
          The row opens the composer unanchored — the door for dumping a trip's
          worth at once, where the subject is picked in the sheet.
        */}
        <Can do="curate">
          <Group eyebrow={t('settings.knowledge')}>
            <SettingsRow
              emoji="✍️"
              label={t('curate.menuLabel')}
              sublabel={t('settings.addWhatYouKnowSub')}
              onPress={() => curateSheet.open({ view: null })}
              trailing={<Icon name="chevron-right" size={14} className="text-text-soft" />}
            />
            {/*
              The ledger. Load-bearing rather than decorative: the write flow has
              no receipt, so this is the only place an insider can see what their
              prose became — or take a note back.
            */}
            <SettingsRow
              emoji="📓"
              label={t('settings.whatYouveAdded')}
              sublabel={t('settings.whatYouveAddedSub')}
              onPress={() => router.push('/my-notes')}
              trailing={<Icon name="chevron-right" size={14} className="text-text-soft" />}
            />
          </Group>
        </Can>

        {/* Subscription */}
        <Group eyebrow={t('settings.subscription')}>
          <SettingsRow
            emoji={planMeta?.emoji}
            label={t('settings.yourPlan')}
            sublabel={planMeta ? `${planMeta.label} · ${planMeta.price}` : undefined}
            onPress={() => router.push('/plans')}
            trailing={
              <View className="flex-row items-center gap-2">
                {planMeta ? <StatusPill variant="warm">{t('settings.planActive')}</StatusPill> : null}
                <Icon name="chevron-right" size={14} className="text-text-soft" />
              </View>
            }
          />
          {/* billing renders but is inert — no destination yet. */}
          <SettingsRow
            icon="card"
            label={t('settings.billing')}
            sublabel={t('settings.billingSub')}
            trailing={<Icon name="chevron-right" size={14} className="text-text-soft" />}
          />
        </Group>

        {/* Appearance */}
        <Group eyebrow={t('settings.appearance')}>
          <View className="gap-2.5 py-1">
            <View className="flex-row items-center gap-3">
              <View className="h-8 w-8 items-center justify-center rounded-small bg-bg">
                <Icon name="sun" size={15} className="text-text" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-body font-medium text-text">{t('settings.vibe')}</Text>
                <Text className="text-small text-text-muted">{t('settings.vibeSub')}</Text>
              </View>
            </View>
            <SegmentedControl
              options={THEME_OPTIONS.map((o) => ({
                value: o.value,
                label: t(o.labelKey),
                icon: o.icon,
              }))}
              value={choice}
              onChange={setChoice}
            />
          </View>
        </Group>

        {/* Help */}
        <Group eyebrow={t('settings.help')}>
          <SettingsRow
            emoji="🛟"
            label={t('settings.rowHelp')}
            sublabel={t('settings.rowHelpSub')}
            onPress={() => router.push('/help')}
            trailing={<Icon name="chevron-right" size={14} className="text-text-soft" />}
          />
        </Group>

        {/* Data */}
        <Group eyebrow={t('settings.yourData')}>
          <SettingsRow
            icon="trash"
            danger
            label={t('settings.nuke')}
            sublabel={t('settings.nukeSub')}
            onPress={() => setNukeOpen(true)}
          />
        </Group>

        {/* Account */}
        <Group eyebrow={t('settings.account')}>
          <SettingsRow
            icon="log-out"
            label={t('settings.logOut')}
            onPress={() => setLogoutOpen(true)}
          />
        </Group>

        {/* Footer — version + legal. Visual only until the legal pages exist
            (no dead taps; link taps would be silent per the haptic map anyway). */}
        <Text className="py-2 text-center text-small text-text-soft">
          {t('settings.footerVersion', { version })} ·{' '}
          <Text className="underline">{t('auth.terms')}</Text> ·{' '}
          <Text className="underline">{t('auth.privacy')}</Text>
        </Text>
      </ScrollView>

      <ConfirmSheet
        open={nukeOpen}
        title={t('settings.nukeTitle')}
        body={t('settings.nukeBody')}
        confirmLabel={t('settings.nukeConfirm')}
        onConfirm={handleNuke}
        onClose={() => setNukeOpen(false)}
      />
      <ConfirmSheet
        open={logoutOpen}
        title={t('settings.logOutTitle')}
        body={t('settings.logOutBody')}
        confirmLabel={t('settings.logOutConfirm')}
        onConfirm={handleLogout}
        onClose={() => setLogoutOpen(false)}
        tone="primary"
      />
    </ScreenScaffold>
  );
}
