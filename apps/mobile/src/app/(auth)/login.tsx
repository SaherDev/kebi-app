import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mascot } from '../../components/mascot';
import { Icon } from '../../components/icon';
import { Spinner } from '../../components/spinner';
import { SocialButton } from '../../components/auth/social-button';
import { AuthDivider } from '../../components/auth/auth-divider';
import { SmartInput, type SmartInputHandle } from '../../components/auth/smart-input';
import { GoogleGlyph, AppleGlyph } from '../../components/auth/brand-glyphs';
import { detectChannel, isValidEmail, isValidPhone } from '../../auth/detect-channel';
import { useAuth } from '../../auth/auth-context';
import { PRESS } from '../../theme/motion';
import { useTranslation } from '../../i18n/context';

/**
 * Login screen (kebi-login-mockup.{html,png}): brand, intro, Google + Apple
 * social buttons, an "or" divider, a smart email/phone input, a send-me-a-code
 * button, and legal copy.
 *
 * Send-code requests an OTP and routes to the verify screen; Google runs the
 * OAuth flow; both surface failures as toasts. Apple stays button-only. A
 * successful sign-in flips auth state and the route guard redirects home.
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { requestOtp, signInWithGoogle } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [sending, setSending] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Inline message shown on-screen (no toasts on the auth screens).
  const [message, setMessage] = useState<{ text: string; tone: 'danger' | 'muted' } | null>(null);
  const inputRef = useRef<SmartInputHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Live mirror of `identifier` so an in-flight send can detect that the user
  // edited the field and ignore its now-stale result.
  const identifierRef = useRef(identifier);
  identifierRef.current = identifier;
  const channel = detectChannel(identifier);

  // Any edit returns the CTA to its normal (enabled, black) state immediately
  // and clears the inline message — never leave the button stuck disabled.
  const handleChangeText = (text: string) => {
    setIdentifier(text);
    setMessage(null);
    setSending(false);
  };

  // On focus, scroll the input + send button fully above the keyboard. The delay
  // lets the keyboard finish animating (and the KeyboardAvoidingView resize) so
  // scrollToEnd lands on the real content bottom.
  const handleInputFocus = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

  const handleSend = async () => {
    if (sending) return;
    setMessage(null);
    // Validate before firing a doomed request. Ambiguous/invalid email → just a
    // shake (kebi-auth-flow.md §Errors); a phone missing its country code gets a
    // helpful hint since that mistake is common.
    if (channel === 'ambiguous' || channel === 'empty') {
      inputRef.current?.shake();
      return;
    }
    if (channel === 'email' && !isValidEmail(identifier)) {
      inputRef.current?.shake();
      return;
    }
    if (channel === 'phone' && !isValidPhone(identifier)) {
      inputRef.current?.shake();
      setMessage({ text: t('auth.invalidPhone'), tone: 'danger' });
      return;
    }
    const sent = identifier;
    setSending(true);
    const result = await requestOtp(sent);
    // The user edited the field while this was in flight — drop the stale result
    // (handleChangeText already reset the button) instead of re-disabling it.
    if (identifierRef.current !== sent) return;
    setSending(false);
    if (result.ok) {
      router.push('/verify');
    } else if (result.reason === 'invalid_input') {
      inputRef.current?.shake();
    } else if (result.reason === 'too_many') {
      setMessage({ text: t('auth.errTooMany'), tone: 'danger' });
    } else {
      setMessage({ text: t('auth.errNetwork'), tone: 'danger' });
    }
  };

  const handleGoogle = async () => {
    if (googleBusy) return;
    setMessage(null);
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    // Success → the route guard redirects home. Ignore a user-cancelled browser.
    if (!result.ok && result.reason !== 'cancelled') {
      setMessage({ text: t('auth.errNetwork'), tone: 'danger' });
    }
  };


  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="gap-8 px-8 pb-6 pt-10"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
        {/* Brand */}
        <View className="mt-6 gap-4">
          <Mascot size={88} />
          <Text className="text-hero font-bold text-text">{t('brand.wordmark')}</Text>
        </View>

        {/* Intro turn */}
        <View className="gap-2">
          <Text className="text-eyebrow font-semibold uppercase text-text-soft">
            {t('brand.wordmark').toLowerCase()}
          </Text>
          <Text className="text-subtitle text-text">
            {t('auth.introLead')} <Text className="text-text-muted">{t('auth.introMuted')}</Text>
          </Text>
        </View>

        {/* Social auth group */}
        <View className="gap-1 rounded-large bg-surface p-1.5">
          <SocialButton
            glyph={<GoogleGlyph />}
            label={t('auth.continueGoogle')}
            onPress={handleGoogle}
            disabled={googleBusy}
          />
          <SocialButton glyph={<AppleGlyph />} label={t('auth.continueApple')} badge={t('auth.soon')} disabled />
        </View>

        {/* Divider */}
        <AuthDivider label={t('auth.divider')} />

        {/* Smart input + send code */}
        <View className="gap-2">
          <SmartInput
            ref={inputRef}
            value={identifier}
            onChangeText={handleChangeText}
            channel={channel}
            placeholder={t('auth.inputPlaceholder')}
            emailHint={t('auth.looksLikeEmail')}
            phoneHint={t('auth.looksLikePhone')}
            onSubmitEditing={() => void handleSend()}
            onFocus={handleInputFocus}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('auth.sendCode')}
            accessibilityState={{ disabled: sending }}
            // Opacity via style (not a toggled className): NativeWind doesn't
            // reliably clear a conditionally-removed `opacity-*` utility, which
            // left the button stuck grey after a send.
            style={{ opacity: sending ? 0.6 : 1 }}
            className={`flex-row items-center justify-center gap-2 rounded-card bg-text px-4 py-3.5 ${PRESS}`}
          >
            {sending && <Spinner />}
            <Text className="text-body font-semibold text-bg">
              {sending ? t('auth.sendingCode') : t('auth.sendCode')}
            </Text>
            {!sending && <Icon name="arrow-right" size={14} className="text-bg" />}
          </Pressable>
        </View>

        {/* Inline message (errors / info) — no toasts on the auth screens */}
        {message && (
          <Text
            className={`text-center text-small ${
              message.tone === 'danger' ? 'text-danger' : 'text-text-muted'
            }`}
          >
            {message.text}
          </Text>
        )}

        {/* Legal */}
        <Text className="text-center text-small text-text-muted">
          {t('auth.legalPrefix')} <Text className="text-text underline">{t('auth.terms')}</Text>{' '}
          {t('auth.legalAnd')} <Text className="text-text underline">{t('auth.privacy')}</Text>
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
