import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { PLAN_TIERS } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Icon, type IconName } from '../components/icon';
import { Group } from '../components/group';
import { StatusPill } from '../components/status-pill';
import { ProfileAvatar } from '../components/profile-avatar';
import { SegmentedControl } from '../components/segmented-control';
import { EditNameSheet } from '../components/edit-name-sheet';
import { ConfirmSheet } from '../components/confirm-sheet';
import { useProfile } from '../components/use-profile';
import { useThemePreference } from '../components/use-theme-preference';
import { useToast } from '../components/toast-context';
import { useApiClient } from '../api/hooks';
import { updateProfile } from '../api/profile';
import { deleteUserData } from '../api/user-data';
import { PRESS } from '../theme/motion';
import { useTranslation } from '../i18n/context';
import { useAuth } from '../auth/auth-context';
import { supabase } from '../lib/supabase';
import type { ThemeChoice } from '../lib/theme-preference';

/**
 * Settings — "you, basically" (kebi-settings-mockup.html). Profile (name/email/
 * plan), subscription, appearance (light/dark/system), data, and account. The
 * profile read comes from the gateway-local /user/profile (the client is
 * otherwise blind to identity); the name edit writes back through it. billing is
 * rendered but inert, export is intentionally absent, and there's no plan status
 * pill (no subscription-status data exists yet).
 */

/** A settings row: icon-square (or emoji) + label + optional sublabel + trailing. */
function SettingsRow({
  icon,
  emoji,
  label,
  sublabel,
  danger = false,
  trailing,
  onPress,
}: {
  icon?: IconName;
  emoji?: string;
  label: string;
  sublabel?: string;
  danger?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View
        className={`h-8 w-8 items-center justify-center rounded-small ${
          danger ? 'bg-pill-danger-bg' : 'bg-bg'
        }`}
      >
        {emoji ? (
          <Text className="leading-none" style={{ fontSize: 16 }}>
            {emoji}
          </Text>
        ) : icon ? (
          <Icon name={icon} size={15} className={danger ? 'text-danger' : 'text-text'} />
        ) : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className={`text-body font-medium ${danger ? 'text-danger' : 'text-text'}`}>
          {label}
        </Text>
        {sublabel ? <Text className="text-small text-text-muted">{sublabel}</Text> : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return <View className="flex-row items-center gap-3 py-2">{body}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-3 py-2 ${PRESS}`}
    >
      {body}
    </Pressable>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; labelKey: string; icon: IconName }[] = [
  { value: 'light', labelKey: 'settings.themeLight', icon: 'sun' },
  { value: 'dark', labelKey: 'settings.themeDark', icon: 'moon' },
  { value: 'system', labelKey: 'settings.themeSystem', icon: 'monitor' },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOut } = useAuth();
  const { profile, setLocalName, refetch } = useProfile();
  // Re-read the profile when settings regains focus (e.g. returning from the
  // plans screen after a switch) so the plan row reflects the new tier. The
  // in-screen name edit doesn't navigate, so this never races that flow.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const { choice, setChoice } = useThemePreference();
  const toast = useToast();
  const client = useApiClient();

  const [editOpen, setEditOpen] = useState(false);
  const [nukeOpen, setNukeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const anySheetOpen = editOpen || nukeOpen || logoutOpen;

  const name = profile?.name ?? '';
  const email = profile?.email ?? '';
  const planMeta = profile ? PLAN_TIERS[profile.plan] : null;
  const version = Constants.expoConfig?.version ?? '';

  const handleSaveName = async (next: string) => {
    setEditOpen(false);
    const previous = name;
    setLocalName(next); // optimistic — the JWT stays stale until refreshSession
    try {
      await updateProfile(client, next);
      toast.show({ tone: 'success', icon: 'check', text: t('settings.toast.nameSaved') });
      // Mint a fresh token so the next mount reads the new name, not the stale one.
      await supabase.auth.refreshSession();
    } catch {
      setLocalName(previous); // roll back
      toast.show({ tone: 'danger', icon: 'alert', text: t('settings.toast.nameFailed') });
    }
  };

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
          <View className="flex-1">
            <Text className="text-subtitle font-bold text-text">
              {name || t('settings.addName')}
            </Text>
            {email ? <Text className="text-small text-text-muted">{email}</Text> : null}
          </View>
          <IconButton icon="edit" label={t('settings.editName')} onPress={() => setEditOpen(true)} />
        </View>

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

      <EditNameSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleSaveName}
        initialName={name}
      />
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
