import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnstableNativeVariable } from 'nativewind';
import {
  ABOUT_ME_MAX_LENGTH,
  CALL_ME_MAX_LENGTH,
  countryByCode,
  countryFlag,
} from '@kebi-app/shared';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Icon } from '../components/icon';
import { CountryPickerSheet } from '../components/country-picker-sheet';
import { ErrorRow } from '../components/error-row';
import { FieldsSkeleton } from '../components/fields-skeleton';
import { Spinner } from '../components/spinner';
import { useToast } from '../components/toast-context';
import { useApiClient } from '../api/hooks';
import { getUserSettings, updateAboutMe } from '../api/user-settings';
import { useTranslation } from '../i18n/context';
import type { FormStatus } from '../lib/form-status';
import { supabase } from '../lib/supabase';
import { PRESS } from '../theme/motion';

/**
 * "about you" — the about-me kebi reads as a cold-start prior (kebi ADR-154).
 *
 * Three fields, one save, written as a whole block: an omitted field is cleared
 * server-side, not preserved, so the screen always sends all three and says so.
 * The country is a picker because the gateway 400s anything that is not alpha-2.
 *
 * Saving re-stamps the token claim, so a fresh session is minted afterwards —
 * without it the next chat turn would go out with the old profile.
 */
export default function AboutYouScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const client = useApiClient();
  const softColor = useUnstableNativeVariable('--text-soft') ?? undefined;

  const [status, setStatus] = useState<FormStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [callMe, setCallMe] = useState('');
  const [homeCountry, setHomeCountry] = useState<string | null>(null);
  const [about, setAbout] = useState('');

  // Client identity is stable per render, so the load runs once on mount and
  // again only when the user retries.
  const clientRef = useRef(client);
  clientRef.current = client;

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const settings = await getUserSettings(clientRef.current);
      setCallMe(settings.about_me?.call_me ?? '');
      setHomeCountry(settings.about_me?.home_country ?? null);
      setAbout(settings.about_me?.about ?? '');
      setStatus('ready');
    } catch {
      // A block we could not read is not a block the user cleared. The form
      // stays unwritable until we have it — see the `failed` branch below.
      setStatus('failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const country = countryByCode(homeCountry);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAboutMe(client, {
        call_me: callMe.trim(),
        home_country: homeCountry,
        about: about.trim(),
      });
      toast.show({ tone: 'success', icon: 'check', text: t('aboutYou.saved') });
      // The block rides the token claim — mint a fresh one so kebi hears it now.
      await supabase.auth.refreshSession();
      router.back();
    } catch {
      toast.show({ tone: 'danger', icon: 'alert', text: t('aboutYou.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScaffold
      showFab={!pickerOpen}
      topBar={
        <TopBar
          left={<IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />}
        />
      }
    >
      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Static copy — never waits on the read (ADR-056). */}
        <View className="gap-1">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('aboutYou.eyebrow')}
          </Text>
          <Text className="font-bold text-hero text-text">{t('aboutYou.hero')}</Text>
          <Text className="mt-1 text-small leading-5 text-text-muted">{t('aboutYou.lede')}</Text>
        </View>

        {status !== 'ready' ? (
          <>
            {status === 'failed' ? (
              <ErrorRow
                text={t('aboutYou.loadFailed')}
                detail={t('aboutYou.loadFailedDetail')}
                actionLabel={t('common.retry')}
                onAction={() => void load()}
              />
            ) : null}
            {/*
              No inputs and no save button until the read succeeds. This form
              writes the block whole, so an empty field here is indistinguishable
              from a cleared one — rendering editable blanks over a profile we
              failed to read is how a network blip becomes data loss.
            */}
            <FieldsSkeleton
              frozen={status === 'failed'}
              labels={[t('aboutYou.callMe'), t('aboutYou.homeCountry'), t('aboutYou.gist')]}
            />
          </>
        ) : (
          <>
          {/* call me */}
          <View className="gap-2">
            <Text className="ps-1 text-eyebrow font-semibold uppercase text-text-soft">
              {t('aboutYou.callMe')}
            </Text>
            <View className="rounded-large bg-surface px-3.5 py-3.5">
              <TextInput
                value={callMe}
                onChangeText={setCallMe}
                placeholder={t('aboutYou.callMePlaceholder')}
                placeholderTextColor={softColor}
                maxLength={CALL_ME_MAX_LENGTH}
                autoCapitalize="words"
                returnKeyType="done"
                className="p-0 text-[16px] leading-6 text-text"
              />
            </View>
            <View className="flex-row justify-between gap-3 ps-1">
              <Text className="flex-1 text-small text-text-muted">{t('aboutYou.callMeHint')}</Text>
              <Text className="text-small text-text-soft">
                {callMe.length}/{CALL_ME_MAX_LENGTH}
              </Text>
            </View>
          </View>

          {/* home country */}
          <View className="gap-2">
            <Text className="ps-1 text-eyebrow font-semibold uppercase text-text-soft">
              {t('aboutYou.homeCountry')}
            </Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('aboutYou.homeCountry')}
              className={`flex-row items-center gap-3 rounded-large bg-surface px-3.5 py-3.5 ${PRESS}`}
            >
              <Text className="text-[20px]">
                {country ? countryFlag(country.code) : '🌍'}
              </Text>
              <Text
                className={`flex-1 text-body ${country ? 'text-text' : 'text-text-soft'}`}
                numberOfLines={1}
              >
                {country ? country.name : t('aboutYou.countryPlaceholder')}
              </Text>
              <Icon name="chevron-right" size={14} className="text-text-soft" />
            </Pressable>
            <Text className="ps-1 text-small text-text-muted">{t('aboutYou.countryHint')}</Text>
          </View>

          {/* the gist */}
          <View className="gap-2">
            <Text className="ps-1 text-eyebrow font-semibold uppercase text-text-soft">
              {t('aboutYou.gist')}
            </Text>
            <View className="rounded-large bg-surface px-3.5 py-3.5">
              <TextInput
                value={about}
                onChangeText={setAbout}
                placeholder={t('aboutYou.gistPlaceholder')}
                placeholderTextColor={softColor}
                maxLength={ABOUT_ME_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                className="min-h-[112px] p-0 text-[16px] leading-6 text-text"
              />
            </View>
            <View className="flex-row justify-between gap-3 ps-1">
              <Text className="flex-1 text-small text-text-muted">{t('aboutYou.gistHint')}</Text>
              <Text className="text-small text-text-soft">
                {about.length}/{ABOUT_ME_MAX_LENGTH}
              </Text>
            </View>
          </View>

          <View className="rounded-large bg-surface px-3.5 py-3">
            <Text className="text-small leading-5 text-text-muted">{t('aboutYou.wholeBlock')}</Text>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={t('aboutYou.save')}
            accessibilityState={{ disabled: saving }}
            // Disabled dim via inline style — NativeWind can leave a toggled
            // opacity-* class stuck (see button.tsx).
            style={{ opacity: saving ? 0.4 : 1 }}
            className={`flex-row items-center justify-center gap-2 rounded-card bg-text px-4 py-3.5 ${PRESS}`}
          >
            {saving ? <Spinner /> : null}
            <Text className="text-small font-semibold text-bg">
              {saving ? t('aboutYou.saving') : t('aboutYou.save')}
            </Text>
          </Pressable>
          </>
        )}
      </ScrollView>

      <CountryPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={homeCountry}
        onSelect={(code) => {
          setHomeCountry(code);
          setPickerOpen(false);
        }}
      />
    </ScreenScaffold>
  );
}
