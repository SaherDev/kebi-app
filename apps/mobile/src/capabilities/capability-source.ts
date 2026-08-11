import type { CapabilitySet } from './capability';

/**
 * What a capability source reports. This shape — **not** the endpoint, the
 * transport, or the refresh strategy — is what the rest of the app depends on.
 *
 * `resolved` is the load-bearing field. It distinguishes "we asked and the
 * answer is no" from "we have not asked yet", which the gate needs in order to
 * fail closed without flashing affordances on and then off. Consumers must
 * never treat `!resolved` as permission.
 */
export interface CapabilityState {
  capabilities: CapabilitySet;
  /** True once an authoritative answer has landed (or the caller is signed out). */
  resolved: boolean;
  /** Ask again now. Safe to call repeatedly; the source coalesces. */
  revalidate: () => void;
}

/**
 * **The v2 seam.** A source is any hook returning {@link CapabilityState}.
 *
 * Today's implementation reads `GET /user/profile`, so a grant lands whenever
 * that is re-read. Making revocation faster is explicitly out of scope now — but
 * it is a *source* concern, not a consumer concern: a websocket push, a poll, a
 * short-TTL check before each gated action, or a token-claim read all satisfy
 * this interface. Swapping one in means passing a different `source` to the
 * provider. No screen, gate, or call site changes, because none of them can see
 * where the answer came from.
 *
 * The rule that keeps it that way: nothing outside this folder may import a
 * concrete source, and nothing may read a capability except through the gate.
 */
export type CapabilitySource = () => CapabilityState;
