import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MOVEMENT_MODES, REACH_VALUES } from '@kebi-app/shared';
import type { MovementMode, Reach } from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { SegmentedControl } from '../components/segmented-control';
import { ErrorRow } from '../components/error-row';
import { FieldsSkeleton } from '../components/fields-skeleton';
import { Spinner } from '../components/spinner';
import { useToast } from '../components/toast-context';
import { useApiClient } from '../api/hooks';
import { getUserSettings, updateMovementProfile } from '../api/user-settings';
import { useTranslation } from '../i18n/context';
import type { FormStatus } from '../lib/form-status';
import { triggerHaptic } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import { PRESS } from '../theme/motion';

/**
 * "getting around" — the movement modes kebi searches with (kebi ADR-155/156).
 *
 * Saving here is the whole point: it is the only path that marks the profile
 * `source: "user"`, and until it happens kebi ignores whatever modes the config
 * seeded and deliberately guesses wide. So an unsaved screen is not a blank
 * form — it is a live default, which the footer note says out loud.
 *
 * Modes are a capability (licence, vehicles, comfort), never per-city
 * availability: kebi pairs them with the working location's density itself.
 */

/** Glyph per mode — display-only, keyed off the shared vocabulary. */
const MODE_EMOJI: Record<MovementMode, string> = {
  walking: '🚶',
  cycling: '🚲',
  motorbike: '🛵',
  driving: '🚗',
  transit: '🚌',
  rideshare: '🚕',
};

export default function GettingAroundScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const client = useApiClient();

  const [status, setStatus] = useState<FormStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [modes, setModes] = useState<MovementMode[]>([]);
  const [reach, setReach] = useState<Reach>('normal');
  /** Whether a human ever chose these — drives the "kebi is guessing" note. */
  const [chosen, setChosen] = useState(false);

  // Client identity is stable per render, so the load runs once on mount and
  // again only when the user retries.
  const clientRef = useRef(client);
  clientRef.current = client;

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const settings = await getUserSettings(clientRef.current);
      const profile = settings.movement_profile;
      // A seeded profile's modes are still shown — they are a reasonable
      // starting guess to edit — but it does not count as chosen.
      if (profile) {
        setModes(profile.available_modes);
        setReach(profile.reach);
        setChosen(profile.isChosen);
      }
      setStatus('ready');
    } catch {
      // A profile we could not read is not a profile the user cleared, and
      // saving replaces it whole — so the screen stays unwritable until we
      // have it (ADR-056).
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMode = (mode: MovementMode) => {
    triggerHaptic('filter-chip');
    setModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  };

  const handleSave = async () => {
    // An empty list is meaningless as a capability and the gateway rejects it.
    if (saving || modes.length === 0) return;
    setSaving(true);
    try {
      await updateMovementProfile(client, { available_modes: modes, reach });
      toast.show({ tone: 'success', icon: 'check', text: t('gettingAround.saved') });
      // Rides the token claim — mint a fresh one so kebi searches with it now.
      await supabase.auth.refreshSession();
      router.back();
    } catch {
      toast.show({ tone: 'danger', icon: 'alert', text: t('gettingAround.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const canSave = modes.length > 0 && !saving;

  return (
    <ScreenScaffold
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
        />
      }
    >
      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-8 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Static copy — never waits on the read (ADR-056). */}
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('gettingAround.eyebrow')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('gettingAround.hero')}</Text>
          <Text className="mt-1 text-small leading-5 text-text-muted">
            {t('gettingAround.lede')}
          </Text>
        </View>

        {status !== 'ready' ? (
          <>
            {status === 'failed' ? (
              <ErrorRow
                text={t('gettingAround.loadFailed')}
                detail={t('gettingAround.loadFailedDetail')}
                actionLabel={t('common.retry')}
                onAction={() => void load()}
              />
            ) : null}
            <FieldsSkeleton
              frozen={status === 'failed'}
              labels={[t('gettingAround.modes'), t('gettingAround.reach')]}
            />
          </>
        ) : (
          <>
          {/* modes */}
          <View className="gap-2">
            <Text className="ps-1 text-eyebrow font-semibold uppercase text-text-soft">
              {t('gettingAround.modes')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MOVEMENT_MODES.map((mode) => {
                const on = modes.includes(mode);
                return (
                  <Pressable
                    key={mode}
                    onPress={() => toggleMode(mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t(`gettingAround.mode.${mode}`)}
                    className={`flex-row items-center gap-2 rounded-full px-3.5 py-2.5 ${
                      on ? 'bg-text' : 'bg-surface'
                    } ${PRESS}`}
                  >
                    <Text className="text-[15px]">{MODE_EMOJI[mode]}</Text>
                    <Text
                      className={`text-small font-medium ${on ? 'text-bg' : 'text-text-muted'}`}
                    >
                      {t(`gettingAround.mode.${mode}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text className="ps-1 text-small text-text-muted">{t('gettingAround.modesHint')}</Text>
          </View>

          {/* reach */}
          <View className="gap-2">
            <Text className="ps-1 text-eyebrow font-semibold uppercase text-text-soft">
              {t('gettingAround.reach')}
            </Text>
            <SegmentedControl
              options={REACH_VALUES.map((value) => ({
                value,
                label: t(`gettingAround.reachValue.${value}`),
              }))}
              value={reach}
              onChange={setReach}
            />
            <Text className="ps-1 text-small text-text-muted">{t('gettingAround.reachHint')}</Text>
          </View>

          {!chosen ? (
            <View className="rounded-large bg-surface px-3.5 py-3">
              <Text className="text-small leading-5 text-text-muted">
                {t('gettingAround.guessing')}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel={t('gettingAround.save')}
            accessibilityState={{ disabled: !canSave }}
            // Disabled dim via inline style — NativeWind can leave a toggled
            // opacity-* class stuck (see button.tsx).
            style={{ opacity: canSave ? 1 : 0.4 }}
            className={`flex-row items-center justify-center gap-2 rounded-card bg-text px-4 py-3.5 ${PRESS}`}
          >
            {saving ? <Spinner /> : null}
            <Text className="text-small font-semibold text-bg">
              {saving ? t('gettingAround.saving') : t('gettingAround.save')}
            </Text>
          </Pressable>

          {modes.length === 0 ? (
            <Text className="text-center text-small text-text-soft">
              {t('gettingAround.pickOne')}
            </Text>
          ) : null}
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}
