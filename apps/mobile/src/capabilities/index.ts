/**
 * The permission layer's public surface. Import from here, never from the files
 * inside — the concrete source is intentionally not exported, so no screen can
 * bind itself to *how* a capability is learned (see `capability-source.ts`).
 *
 * Ask with `useCan('curate')`, wrap with `<Can do="curate">`, guard a route with
 * `useRequireCapability('curate')`. There is no fourth way, and reading a
 * permission flag off a profile object is a bug.
 */
export type { Capability, CapabilitySet } from './capability';
export type { CapabilityState, CapabilitySource } from './capability-source';
export { CapabilitiesProvider, useCan, useCapabilities, Can } from './capabilities-context';
export { useRequireCapability } from './use-require-capability';
