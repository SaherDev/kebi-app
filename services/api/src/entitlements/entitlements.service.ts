import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlanTier } from '@kebi-app/shared';
import { Entitlements } from './entitlements';

/** Shape of one `entitlements.plans.{tier}` config entry (any key may be absent). */
interface RawEntitlements {
  taste_enabled?: boolean;
  discovery_enabled?: boolean;
  advanced_models_enabled?: boolean;
  save_limit?: number;
  consults_per_day?: number;
}

/** Most-restrictive tier — used when a plan is missing/unknown. */
const FALLBACK_PLAN: PlanTier = 'homebody';

@Injectable()
export class EntitlementsService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Resolve a plan tier to its capabilities from `entitlements.plans.{tier}`
   * config. An unknown or missing plan falls back to the most restrictive tier
   * (homebody) so a mis-stamped token never unlocks a paid feature.
   */
  resolve(plan?: PlanTier): Entitlements {
    const tier = plan ?? FALLBACK_PLAN;
    const raw =
      this.configService.get<RawEntitlements>(`entitlements.plans.${tier}`) ??
      this.configService.get<RawEntitlements>(`entitlements.plans.${FALLBACK_PLAN}`) ??
      {};
    return new Entitlements({
      taste_enabled: raw.taste_enabled ?? false,
      discovery_enabled: raw.discovery_enabled ?? false,
      advanced_models_enabled: raw.advanced_models_enabled ?? false,
      save_limit: raw.save_limit ?? null,
      consults_per_day: raw.consults_per_day ?? null,
    });
  }
}
