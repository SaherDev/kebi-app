/**
 * The caller's plan capabilities (ADR-112) as a domain instance — not a plain
 * object. The gateway owns plans/billing and forwards these capabilities — never
 * the plan name — to kebi, which enforces them. Booleans fail closed; numeric
 * limits are `null` when unlimited (the `X-Gateway-*` header is then omitted —
 * absent = no cap), so kebi never hard-codes free-tier numbers.
 *
 * Gateway-local on purpose: only the gateway uses this, so it stays out of
 * `libs/shared` (CLAUDE.md — single-app types live in their app). A class, not an
 * interface, to mirror the `AuthenticatedUser` principal it travels beside.
 */
export class Entitlements {
  readonly taste_enabled: boolean;
  readonly discovery_enabled: boolean;
  readonly advanced_models_enabled: boolean;
  readonly save_limit: number | null;
  readonly consults_per_day: number | null;

  constructor(params: {
    taste_enabled: boolean;
    discovery_enabled: boolean;
    advanced_models_enabled: boolean;
    save_limit: number | null;
    consults_per_day: number | null;
  }) {
    this.taste_enabled = params.taste_enabled;
    this.discovery_enabled = params.discovery_enabled;
    this.advanced_models_enabled = params.advanced_models_enabled;
    this.save_limit = params.save_limit;
    this.consults_per_day = params.consults_per_day;
  }
}
