import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createId } from '@paralleldrive/cuid2';
import { NormalizedIdentity } from '@kebi-app/shared';
import { UserIdentityRepository } from './user-identity.repository';

/**
 * Resolves a provider identity to our stable, opaque internal user id.
 *
 * The internal id (`<auth.user_id_prefix><cuid2>`) is what gets forwarded to
 * kebi, so it stays constant across a future provider switch. This is the ONLY
 * place an internal id is minted, and the only identity method that touches the
 * DB — the request path normally reads the id from the signed token claim and
 * never calls this.
 */
@Injectable()
export class UserIdentityService {
  private readonly logger = new Logger(UserIdentityService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly users: UserIdentityRepository,
  ) {}

  /**
   * Return the internal id for `(authProvider, externalId)`, creating the
   * mapping on first sight. Idempotent and race-safe — a concurrent create that
   * loses the unique-constraint race re-reads the winner's row.
   */
  async resolve(
    authProvider: string,
    identity: NormalizedIdentity,
  ): Promise<string> {
    const existing = await this.users.findByExternal(
      authProvider,
      identity.externalId,
    );
    if (existing) return existing.id;

    const id = this.mintId();
    try {
      const created = await this.users.create(
        id,
        authProvider,
        identity.externalId,
        identity.email ?? '',
        identity.phone ?? null,
      );
      return created.id;
    } catch (error) {
      // Unique-constraint race: another request created the row first. Re-read.
      const row = await this.users.findByExternal(
        authProvider,
        identity.externalId,
      );
      if (row) return row.id;
      this.logger.error(
        `Failed to resolve identity for ${authProvider}:${identity.externalId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private mintId(): string {
    const prefix = this.configService.get<string>('auth.user_id_prefix', 'user_');
    return `${prefix}${createId()}`;
  }
}
