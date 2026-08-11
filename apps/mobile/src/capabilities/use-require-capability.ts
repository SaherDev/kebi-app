import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import type { Capability } from './capability';
import { useCapabilities } from './capabilities-context';

/**
 * Route-level gate: bounce off a screen the caller may not have.
 *
 * Hiding the entry points is not enough. A route reachable by deep link, by the
 * iOS share extension, by a back-stack entry left over from before a revocation,
 * or by a stale push is reachable **without ever passing the button we hid** —
 * so the screen has to refuse on its own. This is the difference between an
 * affordance being invisible and a feature being off.
 *
 * Returns whether the screen may render. Callers should render nothing (or a
 * neutral placeholder) while it is `false`:
 *
 * ```tsx
 * const allowed = useRequireCapability('curate');
 * if (!allowed) return null;
 * ```
 *
 * Redirects only once the answer is **authoritative** — an unresolved state
 * renders nothing but does not navigate, so a slow first read never ejects a
 * legitimate insider mid-session. Denial after resolution replaces rather than
 * pushes, so the back button cannot walk straight back in.
 */
export function useRequireCapability(capability: Capability, fallbackPath = '/'): boolean {
  const router = useRouter();
  const { capabilities, resolved } = useCapabilities();
  const allowed = resolved && capabilities[capability];

  useEffect(() => {
    if (resolved && !allowed) {
      router.replace(fallbackPath);
    }
  }, [resolved, allowed, router, fallbackPath]);

  return allowed;
}
