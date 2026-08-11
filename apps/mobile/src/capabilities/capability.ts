/**
 * What this account is permitted to do — the vocabulary the whole app asks in.
 *
 * A capability is **granted by us and revocable at any moment**, which is what
 * separates it from a preference (the user's own setting) and from a plan tier
 * (what they bought). Adding one is a new member of this union plus a line in
 * the source that reads it; every consumer keeps asking the same way.
 */
export type Capability = 'curate';

/** Every capability's current answer. Total by construction — no optional members. */
export type CapabilitySet = Readonly<Record<Capability, boolean>>;

/**
 * The fail-closed baseline: nothing is permitted.
 *
 * This is deliberately the value used for **every** uncertain state — before the
 * first read lands, while signed out, and after any read that failed. There is
 * no "assume yes" path anywhere in the layer, so a user whose grant was revoked
 * (or whose fetch broke) sees the plain app rather than affordances that would
 * 403 on tap.
 */
export const NO_CAPABILITIES: CapabilitySet = Object.freeze({ curate: false });
