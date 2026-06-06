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
 * Product user record. `id` is our stable, opaque internal id — the value
 * forwarded to kebi as `X-Gateway-User-Id`. `(authProvider, externalId)` maps
 * the auth provider's subject to that internal id, so swapping providers never
 * changes a user's downstream identity.
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

  // Descriptive only — identity is keyed by (authProvider, externalId), never
  // by email. Not unique: phone/SMS users have no email and store '', which
  // would otherwise collide on a unique constraint after the first such user.
  @Column()
  email!: string;

  // E.164 phone for phone/SMS sign-ups; null for email/OAuth users. Descriptive
  // only, like email — never an identity key.
  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

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
