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
import { UserEntity } from './user.entity';

@Entity('user_settings')
export class UserSettingsEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'userId', unique: true })
  userId!: string;

  @OneToOne(() => UserEntity, (user) => user.settings)
  @JoinColumn({ name: 'userId' })
  user!: Relation<UserEntity>;

  @Column({ default: 'en' })
  locale!: string;

  @Column({ default: 'system' })
  theme!: string;

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
