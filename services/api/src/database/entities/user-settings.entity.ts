import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
  Relation,
} from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import type { UserSettingsData } from '@kebi-app/shared';
import { UserEntity } from './user.entity';

/**
 * Our per-user product data, keyed by the internal user id — the source of truth
 * for the plan/ai_enabled/movement_profile claims stamped into the token
 * (ADR-045). Stored as one JSON document so new preferences need no migration;
 * read/written whole, by `userId`.
 */
@Entity('user_settings')
export class UserSettingsEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'userId', unique: true })
  userId!: string;

  @OneToOne(() => UserEntity, (user) => user.settings)
  @JoinColumn({ name: 'userId' })
  user!: Relation<UserEntity>;

  @Column({ type: 'jsonb' })
  settings!: UserSettingsData;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
