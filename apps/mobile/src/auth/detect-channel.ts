/**
 * Smart-input channel detection for the login screen. A single text field
 * accepts either an email or a phone number; what the user is typing is detected
 * live to drive the meta hint ("looks like an email" / "…a phone number") and,
 * in the wiring pass, which OTP channel `signInWithOtp` uses.
 *
 * Rules verbatim from docs/kebi-app-design-system/kebi-auth-flow.md §"Smart
 * input behavior":
 *   - contains `@`                         → email
 *   - starts with `+`, or only digits /    → phone
 *     spaces / dashes
 *   - empty (after trim)                   → empty (no hint)
 *   - anything else                        → ambiguous (no hint; validate on submit)
 */
export type AuthChannel = 'email' | 'phone' | 'ambiguous' | 'empty';

/** Phone shape: optional leading `+`, then only digits, spaces and dashes. */
const PHONE_PATTERN = /^\+?[\d\s-]+$/;

export function detectChannel(value: string): AuthChannel {
  const trimmed = value.trim();
  if (trimmed === '') return 'empty';
  if (trimmed.includes('@')) return 'email';
  if (trimmed.startsWith('+') || PHONE_PATTERN.test(trimmed)) return 'phone';
  return 'ambiguous';
}

/** Basic email shape — local@domain.tld, no spaces. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E.164 phone: a leading `+`, a non-zero country code, then 7–15 digits total.
 * A bare local number (e.g. `0525293733`, no `+`/country code) is NOT valid —
 * Supabase needs the country code to deliver the SMS.
 */
const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/** Validates against E.164 after stripping spaces/dashes/parens. */
export function isValidPhone(value: string): boolean {
  return E164_PATTERN.test(value.replace(/[\s()-]/g, ''));
}
