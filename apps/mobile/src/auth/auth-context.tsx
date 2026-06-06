import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { createApiClient } from '../api/client';
import { API_ROUTES } from '../api/routes';
import { detectChannel } from './detect-channel';
import { AUTH } from './constants';

// Finish any auth session left dangling in the system browser (no-op normally).
WebBrowser.maybeCompleteAuthSession();

/** OTP delivery channel — the narrowed half of detectChannel's result. */
export type OtpChannel = 'email' | 'phone';

/** What the verify screen needs: which channel, the value to verify against, and a display string. */
export interface PendingOtp {
  channel: OtpChannel;
  /** Raw value passed to verifyOtp (email address or E.164-ish phone). */
  value: string;
  /** Pretty value shown in the subtitle ("sent a code to <destination>"). */
  destination: string;
}

/** Coarse failure reasons the screens map to toast copy. */
export type AuthErrorReason =
  | 'network'
  | 'invalid_input'
  | 'invalid_code'
  | 'expired'
  | 'too_many'
  | 'cancelled'
  | 'unknown';

export type AuthResult = { ok: true } | { ok: false; reason: AuthErrorReason };

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  /** Only an auth *status* is exposed — never the session or any user data
   *  (ADR-044: the client stays blind to identity). */
  status: AuthStatus;
  pendingOtp: PendingOtp | null;
  /** Send an OTP to an email or phone (channel auto-detected). Sets pendingOtp on success. */
  requestOtp: (identifier: string) => Promise<AuthResult>;
  /** Verify the 6-digit code against the pending channel. */
  verifyOtp: (token: string) => Promise<AuthResult>;
  /** Re-send the code for the pending channel. */
  resendOtp: () => Promise<AuthResult>;
  /** Google OAuth via the system browser (PKCE code exchange). */
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  clearPendingOtp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Pulls the current access token for the Authorization header. This is the only
 * place the opaque credential is read; the session object and user data are
 * never surfaced to the app (ADR-044: the client stays blind to identity).
 */
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

/** Strip spaces/dashes/parens so the value is closer to E.164 for Supabase. */
function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

/** Reject after `ms` so a stalled network call can't hang the UI indefinitely. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/** Map a Supabase AuthError (or a thrown network error) to a coarse reason. */
function reasonFromError(error: AuthError | null): AuthErrorReason {
  if (!error) return 'unknown';
  if (error.status === 429) return 'too_many';
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase();
  if (text.includes('expired')) return 'expired';
  if (text.includes('invalid') || text.includes('token')) return 'invalid_code';
  return 'unknown';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);

  useEffect(() => {
    let mounted = true;
    // Derive auth status only — the session object never enters app state.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setStatus(data.session ? 'authenticated' : 'unauthenticated');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setStatus(session ? 'authenticated' : 'unauthenticated');
      // Provision the product user: POST /auth/login makes the gateway ensure our
      // internal User row exists and stamp internal_id into the token;
      // refreshSession then pulls the new claim. Fires on a fresh sign-in and on a
      // restored session at launch, so the row is re-ensured even if an earlier
      // attempt failed (e.g. backend was down). Idempotent server-side.
      // Event-driven — the app reads neither the session nor user data; the token
      // is fetched only as the Bearer credential. refreshSession emits
      // TOKEN_REFRESHED (not SIGNED_IN/INITIAL_SESSION), so this never loops.
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        createApiClient(getAccessToken)
          .post(API_ROUTES.login, {})
          .then(() => supabase.auth.refreshSession())
          .catch(() => undefined);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const sendOtp = useCallback(
    async (channel: OtpChannel, value: string): Promise<AuthResult> => {
      try {
        const { error } = await withTimeout(
          channel === 'email'
            ? supabase.auth.signInWithOtp({ email: value, options: { shouldCreateUser: true } })
            : supabase.auth.signInWithOtp({ phone: value, options: { shouldCreateUser: true } }),
          AUTH.requestTimeoutMs,
        );
        if (error) return { ok: false, reason: reasonFromError(error) };
        return { ok: true };
      } catch {
        return { ok: false, reason: 'network' };
      }
    },
    [],
  );

  const requestOtp = useCallback(
    async (identifier: string): Promise<AuthResult> => {
      const detected = detectChannel(identifier);
      if (detected !== 'email' && detected !== 'phone') {
        return { ok: false, reason: 'invalid_input' };
      }
      const value = detected === 'phone' ? normalizePhone(identifier) : identifier.trim();
      const result = await sendOtp(detected, value);
      if (result.ok) setPendingOtp({ channel: detected, value, destination: value });
      return result;
    },
    [sendOtp],
  );

  const verifyOtp = useCallback(
    async (token: string): Promise<AuthResult> => {
      if (!pendingOtp) return { ok: false, reason: 'unknown' };
      try {
        const { error } = await withTimeout(
          pendingOtp.channel === 'email'
            ? supabase.auth.verifyOtp({ email: pendingOtp.value, token, type: 'email' })
            : supabase.auth.verifyOtp({ phone: pendingOtp.value, token, type: 'sms' }),
          AUTH.requestTimeoutMs,
        );
        if (error) return { ok: false, reason: reasonFromError(error) };
        setPendingOtp(null);
        return { ok: true };
      } catch {
        return { ok: false, reason: 'network' };
      }
    },
    [pendingOtp],
  );

  const resendOtp = useCallback(async (): Promise<AuthResult> => {
    if (!pendingOtp) return { ok: false, reason: 'unknown' };
    return sendOtp(pendingOtp.channel, pendingOtp.value);
  }, [pendingOtp, sendOtp]);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) return { ok: false, reason: reasonFromError(error) };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return { ok: false, reason: 'cancelled' };

      const code = Linking.parse(result.url).queryParams?.code;
      if (typeof code !== 'string') return { ok: false, reason: 'unknown' };

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) return { ok: false, reason: reasonFromError(exchangeError) };
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setPendingOtp(null);
  }, []);

  const clearPendingOtp = useCallback(() => setPendingOtp(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      pendingOtp,
      requestOtp,
      verifyOtp,
      resendOtp,
      signInWithGoogle,
      signOut,
      clearPendingOtp,
    }),
    [status, pendingOtp, requestOtp, verifyOtp, resendOtp, signInWithGoogle, signOut, clearPendingOtp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
