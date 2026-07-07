import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  Index,
  Relation,
} from 'typeorm';
import { UserSettingsEntity } from './user-settings.entity';

/**
 * Product user record — an opaque identity mapping only. `id` is our stable
 * internal id (forwarded to kebi as `X-Gateway-User-Id`); `(authProvider,
 * externalId)` maps the auth provider's subject to it, so swapping providers
 * never changes a user's downstream identity. No PII lives here: email/phone are
 * owned by the auth provider (Supabase), our product data by `user_settings`
 * (ADR-045). Per-user settings hang off the `settings` relation.
 *
 * The id is minted in UserIdentityService (which injects ConfigService to read
 * the `auth.user_id_prefix`), not in a @BeforeInsert hook — entities can't read
 * config.
 */
@Entity('users')
@Index('uq_users_provider_external', ['authProvider', 'externalId'], {
  unique: true,
})
export class UserEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'authProvider', type: 'varchar' })
  authProvider!: string;

  @Column({ name: 'externalId', type: 'varchar' })
  externalId!: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;

  @OneToOne(() => UserSettingsEntity, (settings) => settings.user, {
    cascade: true,
    eager: false,
  })
  settings?: Relation<UserSettingsEntity>;
}
