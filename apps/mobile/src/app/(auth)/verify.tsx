import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mascot } from '../../components/mascot';
import { IconButton } from '../../components/icon-button';
import { OtpInput, type OtpInputHandle } from '../../components/auth/otp-input';
import { Spinner } from '../../components/spinner';
import { AUTH } from '../../auth/constants';
import { useAuth, type AuthErrorReason } from '../../auth/auth-context';
import { useTranslation } from '../../i18n/context';

/** Seconds → "m:ss" (e.g. 42 → "0:42"). */
function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * OTP verification screen (kebi-otp-email-mockup.html). Reads the pending
 * channel/destination from the auth context, auto-submits the 6-digit code, and
 * lets the user resend (60s cooldown) or go back to change the address. Copy
 * swaps between the email and phone paths; a successful verify flips the session
 * and the route guard redirects home.
 */
export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { pendingOtp, verifyOtp, resendOtp } = useAuth();

  const otpRef = useRef<OtpInputHandle>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState<number>(AUTH.resendCooldownSec);
  const [lockedUntilReset, setLockedUntilReset] = useState(false);
  // Inline message shown on-screen (no toasts on the auth screens).
  const [message, setMessage] = useState<{
    text: string;
    /** `warn` is a boundary rather than a fault — an expired code, a rate limit. */
    tone: 'danger' | 'warn' | 'muted';
  } | null>(null);

  // No pending request (e.g. opened directly / after sign-out) → back to login.
  useEffect(() => {
    if (!pendingOtp) router.replace('/login');
  }, [pendingOtp, router]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const reportError = useCallback(
    (reason: AuthErrorReason) => {
      // Four outcomes, four sentences (ADR-056). Only a wrong code is the
      // user's mistake — the rest are conditions, and marking them in red sends
      // people re-checking a code that was fine.
      switch (reason) {
        case 'expired':
          setMessage({ text: t('auth.errExpired'), tone: 'warn' });
          // Our expiry, our wait: the cooldown is waived so "send a new code"
          // is available immediately rather than 47 seconds from now.
          setCooldown(0);
          otpRef.current?.shakeAndClear();
          break;
        case 'too_many':
          setMessage({ text: t('auth.errTooMany'), tone: 'warn' });
          setLockedUntilReset(true);
          setCooldown(AUTH.resendCooldownSec);
          otpRef.current?.shakeAndClear();
          break;
        case 'network':
          setMessage({ text: t('auth.errNetwork'), tone: 'warn' });
          // Nothing was wrong with what they typed — leave it be.
          break;
        default:
          setMessage({ text: t('auth.errWrongCode'), tone: 'danger' });
          otpRef.current?.shakeAndClear();
      }
    },
    [t],
  );

  const handleComplete = useCallback(
    async (code: string) => {
      if (verifying) return;
      setMessage(null);
      setVerifying(true);
      const result = await verifyOtp(code);
      setVerifying(false);
      // On success the auth state flips and the route guard redirects home.
      if (!result.ok) reportError(result.reason);
    },
    [verifying, verifyOtp, reportError],
  );

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    const result = await resendOtp();
    if (result.ok) {
      setLockedUntilReset(false);
      setCooldown(AUTH.resendCooldownSec);
      setMessage({ text: t('auth.codeResent'), tone: 'muted' });
    } else {
      reportError(result.reason);
    }
  }, [cooldown, resendOtp, t, reportError]);

  if (!pendingOtp) return null;

  const isEmail = pendingOtp.channel === 'email';
  const title = isEmail ? t('auth.checkEmail') : t('auth.checkMessages');
  const changeQuestion = isEmail ? t('auth.wrongEmail') : t('auth.wrongNumber');

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 py-2">
        <IconButton icon="back" label={t('common.back')} onPress={() => router.back()} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-8 px-8 pb-6 pt-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
        {/* Hero */}
        <View className="items-center gap-4">
          <Mascot size={56} />
          <Text className="text-center text-title font-bold text-text">{title}</Text>
          <Text className="max-w-[280px] text-center text-small text-text-muted">
            {t('auth.sentCodeTo')}{' '}
            <Text className="font-semibold text-text">{pendingOtp.destination}</Text>
          </Text>
        </View>

        {/* Code boxes (auto-submit on fill) */}
        <OtpInput ref={otpRef} onComplete={handleComplete} disabled={verifying || lockedUntilReset} />

        {/* The sixth digit auto-submits, so there is no button to hold the
            in-flight state — a beat of silence here reads as a dead app. */}
        {verifying ? (
          <View className="flex-row items-center justify-center gap-2">
            <Spinner size={13} />
            <Text className="text-small text-text-muted">{t('auth.checking')}</Text>
          </View>
        ) : message ? (
          /* Inline message (errors / info) — no toasts on the auth screens */
          <Text
            className={`text-center text-small ${
              message.tone === 'danger'
                ? 'text-danger'
                : message.tone === 'warn'
                  ? 'text-warn'
                  : 'text-text-muted'
            }`}
          >
            {message.text}
          </Text>
        ) : null}

        {/* Resend + change */}
        <View className="items-center gap-3.5">
          <Text className="text-small text-text-muted">
            {t('auth.didntGetIt')}{' '}
            {cooldown > 0 ? (
              <Text>
                {t('auth.resendInLabel')}{' '}
                <Text className="font-semibold text-text">{formatCountdown(cooldown)}</Text>
              </Text>
            ) : (
              <Text className="font-semibold text-text underline" onPress={handleResend}>
                {t('auth.resendCta')}
              </Text>
            )}
          </Text>
          <Text className="text-small text-text-muted">
            {changeQuestion}{' '}
            <Text className="font-semibold text-text underline" onPress={() => router.back()}>
              {t('auth.changeIt')}
            </Text>
          </Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
