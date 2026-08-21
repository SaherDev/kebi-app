import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Whether this process is running somewhere deployed — the only question the
 * environment-sensitive guards (dev-bypass auth, DB schema sync) are allowed
 * to ask about where they are.
 *
 * A committed config file cannot be trusted to say which environment it is
 * running in, because it is the same file everywhere — that mistake once left
 * the dev auth bypass live in production. So this reads runtime markers only,
 * and callers must fail closed on `true`: any sign of a deployment denies the
 * dangerous behaviour, whatever else is configured.
 *
 * Railway sets RAILWAY_ENVIRONMENT in every deployment; NODE_ENV covers any
 * other host. Presence alone is the signal — the value is not consulted, so a
 * staging deployment is as forbidden as production.
 */
export function isDeployedEnvironment(config: ConfigService): boolean {
  return (
    config.get<string>('RAILWAY_ENVIRONMENT') !== undefined ||
    config.get<string>('NODE_ENV') === 'production'
  );
}

/**
 * Whether TypeORM may auto-sync the gateway schema on boot (ADR-035). Local
 * dev only: opt-in via the `DB_SYNCHRONIZE` env var, and refused outright when
 * the process runs deployed — auto-sync against a database holding real user
 * data can drop or mangle columns on an entity edit, and an env var is one
 * accidental `true` away. Deployed schema changes are a deliberate act
 * (explicit migrations are the follow-up ADR-035 already owes).
 */
export function resolveSchemaSynchronize(config: ConfigService): boolean {
  const requested = config.get<string>('DB_SYNCHRONIZE') === 'true';
  if (requested && isDeployedEnvironment(config)) {
    new Logger('TypeORM').warn(
      'DB_SYNCHRONIZE=true ignored: schema auto-sync is refused in deployed environments.',
    );
    return false;
  }
  return requested;
}
