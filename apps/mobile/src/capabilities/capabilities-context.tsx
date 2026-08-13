import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { NO_CAPABILITIES, type Capability } from './capability';
import type { CapabilitySource, CapabilityState } from './capability-source';
import { useProfileCapabilitySource } from './profile-capability-source';

/**
 * The one place the app learns what it may do.
 *
 * Every affordance for a permission-gated feature — a row, a menu item, a
 * button, a whole route — passes through {@link useCan} or {@link Can}. Nothing
 * reads a capability flag off a profile object, a prop, or a screen's own state.
 * That single chokepoint is the whole point: revoking a grant is provably total
 * because there is exactly one thing to flip, not N conditionals someone has to
 * remember. Adding a capability never adds a pattern.
 *
 * This layer is **display only**. It decides what to draw, never what is
 * allowed: every curation route is independently enforced server-side by
 * `CuratorGuard` reading the token claim, and again by kebi via
 * `X-Gateway-Can-Curate`. A client that lies to itself renders a button and
 * earns a 403 — it does not get a write.
 */

/** Default is the denied state, so a consumer mounted outside the provider is safe. */
const CapabilitiesContext = createContext<CapabilityState>({
  capabilities: NO_CAPABILITIES,
  resolved: false,
  revalidate: () => undefined,
});

interface CapabilitiesProviderProps {
  children: ReactNode;
  /**
   * Override the source — the {@link CapabilitySource} seam. Production leaves
   * this unset; tests and any future revocation strategy pass their own.
   */
  source?: CapabilitySource;
}

export function CapabilitiesProvider({ children, source }: CapabilitiesProviderProps) {
  // A hook by another name: `source` is stable for the provider's lifetime (it
  // is either absent or a module-level function), so calling it here obeys the
  // rules of hooks. Swapping sources means remounting the provider, which is
  // what a strategy change should cost.
  const useSource = source ?? useProfileCapabilitySource;
  const state = useSource();

  const value = useMemo<CapabilityState>(
    () => ({
      capabilities: state.capabilities,
      resolved: state.resolved,
      revalidate: state.revalidate,
    }),
    [state.capabilities, state.resolved, state.revalidate],
  );

  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
}

/**
 * May the caller do this? The only question the app asks.
 *
 * Returns `false` until an authoritative answer has landed, so an unresolved
 * state is a denial rather than a gamble — no affordance flashes in and then
 * disappears, and a slow network never opens a door.
 */
export function useCan(capability: Capability): boolean {
  const { capabilities, resolved } = useContext(CapabilitiesContext);
  return resolved && capabilities[capability];
}

/**
 * The raw state, for the few callers that need more than a yes/no — a screen
 * distinguishing "loading" from "denied", or anything wanting {@link
 * CapabilityState.revalidate} (pull-to-refresh, returning from background, or a
 * future push telling us a grant changed).
 *
 * Prefer {@link useCan} for rendering decisions. Reach for this only when the
 * difference between "not yet known" and "not allowed" is visible to the user.
 */
export function useCapabilities(): CapabilityState {
  return useContext(CapabilitiesContext);
}

interface CanProps {
  /** The capability required to render `children`. */
  do: Capability;
  children: ReactNode;
  /** Rendered instead when the caller lacks it. Defaults to nothing at all. */
  fallback?: ReactNode;
}

/**
 * Declarative gate: `<Can do="curate">…</Can>`.
 *
 * Prefer this over an inline `useCan()` ternary when wrapping a whole affordance
 * — it reads as a permission boundary at the call site, which is what makes an
 * ungated surface obvious in review.
 */
export function Can({ do: capability, children, fallback = null }: CanProps): ReactNode {
  return useCan(capability) ? children : fallback;
}
