import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';

/**
 * Repository for the provider → internal-id mapping. The only data-access layer
 * for resolving identities. Product table only (`users`) — never AI-owned tables.
 */
@Injectable()
export class UserIdentityRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  findByExternal(
    authProvider: string,
    externalId: string,
  ): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { authProvider, externalId } });
  }

  /**
   * Persist a new mapping row. `id` is the pre-built internal id (the caller
   * mints it from config so the prefix isn't hardcoded here).
   */
  create(
    id: string,
    authProvider: string,
    externalId: string,
    email: string,
  ): Promise<UserEntity> {
    return this.repo.save(
      this.repo.create({ id, authProvider, externalId, email }),
    );
  }
}
