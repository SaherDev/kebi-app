import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  BeforeInsert,
} from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { UserSettingsEntity } from './user-settings.entity';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ unique: true })
  email!: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;

  @OneToOne(() => UserSettingsEntity, (settings) => settings.user, {
    cascade: true,
    eager: false,
  })
  settings?: UserSettingsEntity;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
