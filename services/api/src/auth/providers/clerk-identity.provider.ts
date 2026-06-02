import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import { MovementProfile, NormalizedIdentity, PlanTier } from '@kebi-app/shared';
import { IdentityProvider } from '../identity-provider.interface';

/** Shape of the claims kebi/AuthUser care about inside Clerk `public_metadata`. */
interface ClerkPublicMetadata {
  ai_enabled?: boolean;
  plan?: PlanTier;
  movement_profile?: MovementProfile;
  internal_id?: string;
}

/**
 * Clerk implementation of IdentityProvider. Contains all Clerk-specific
 * knowledge: the `@clerk/backend` SDK call, the `sub` → externalId mapping, and
 * the `public_metadata` claim location. A future provider implements the same
 * interface against its own SDK and claim source.
 */
@Injectable()
export class ClerkIdentityProvider implements IdentityProvider {
  readonly name = 'clerk';

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string): Promise<NormalizedIdentity> {
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY not configured');
    }

    const session = await verifyToken(token, { secretKey });

    const externalId = session.sub;
    if (!externalId) {
      throw new UnauthorizedException('Invalid token: missing subject');
    }

    const aiEnabledDefault = this.configService.get<boolean>(
      'ai.enabled_default',
      true,
    );
    const meta = (session.public_metadata ?? {}) as ClerkPublicMetadata;

    return {
      externalId,
      email: typeof session['email'] === 'string' ? session['email'] : undefined,
      claims: {
        ai_enabled: meta.ai_enabled ?? aiEnabledDefault,
        plan: meta.plan,
        movement_profile: meta.movement_profile,
        internal_id: meta.internal_id,
      },
    };
  }
}
