import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UserSettingsData } from '@kebi-app/shared';
import { UserSettingsEntity } from '../database/entities/user-settings.entity';

/**
 * Data access for `user_settings` — our per-user product data, keyed by the
 * internal user id. Product table only (ADR-045); never AI-owned tables.
 */
@Injectable()
export class UserSettingsRepository {
  constructor(
    @InjectRepository(UserSettingsEntity)
    private readonly repo: Repository<UserSettingsEntity>,
  ) {}

  findByUserId(userId: string): Promise<UserSettingsEntity | null> {
    return this.repo.findOne({ where: { userId } });
  }

  /** Persist a settings row (the JSON document) for a user. */
  create(userId: string, settings: UserSettingsData): Promise<UserSettingsEntity> {
    return this.repo.save(this.repo.create({ userId, settings }));
  }
}
