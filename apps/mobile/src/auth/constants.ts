/**
 * Auth-flow constants that aren't theme/motion tokens. Kept here (mirroring
 * src/theme/{motion,palette}.ts) so no bare literal lives inline in the auth
 * components — the zero-hardcoding rule (CLAUDE.md §Standards).
 *
 */
export const AUTH = {
  /**
   * How long the smart input shows its shake + red border after an invalid
   * submit (ambiguous/empty input), per kebi-auth-flow.md §Errors
   * ("red text-soft border for 800ms").
   */
  invalidShakeMs: 800,
  /** Number of digits in the OTP (kebi-auth-flow.md — "6 single-digit boxes"). */
  otpLength: 6,
  /** Resend cooldown in seconds (kebi-auth-flow.md §Resend cooldown — "60-second timer"). */
  resendCooldownSec: 60,
  /** Hard ceiling on an auth request so the UI never hangs on a stalled call. */
  requestTimeoutMs: 12000,
} as const;
