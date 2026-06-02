import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NormalizedIdentity } from '@kebi-app/shared';
import { UserIdentityService } from './user-identity.service';
import { UserIdentityRepository } from './user-identity.repository';
import { UserEntity } from '../database/entities/user.entity';

function makeIdentity(externalId = 'ext_1'): NormalizedIdentity {
  return { externalId, email: 'a@b.com', claims: {} };
}

function makeRow(id: string, externalId: string): UserEntity {
  return { id, authProvider: 'clerk', externalId, email: 'a@b.com' } as UserEntity;
}

describe('UserIdentityService', () => {
  let service: UserIdentityService;
  let repo: jest.Mocked<UserIdentityRepository>;
  const config = {
    get: jest.fn((key: string, dflt?: unknown) =>
      key === 'auth.user_id_prefix' ? 'user_' : dflt,
    ),
  } as unknown as ConfigService;

  beforeEach(() => {
    repo = {
      findByExternal: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UserIdentityRepository>;
    service = new UserIdentityService(config, repo);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns the existing internal id without creating', async () => {
    repo.findByExternal.mockResolvedValue(makeRow('user_existing', 'ext_1'));

    const id = await service.resolve('clerk', makeIdentity());

    expect(id).toBe('user_existing');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('mints a prefixed id on first sight', async () => {
    repo.findByExternal.mockResolvedValue(null);
    repo.create.mockImplementation((id) =>
      Promise.resolve(makeRow(id, 'ext_1')),
    );

    const id = await service.resolve('clerk', makeIdentity());

    expect(id).toMatch(/^user_/);
    expect(repo.create).toHaveBeenCalledWith(
      expect.stringMatching(/^user_/),
      'clerk',
      'ext_1',
      'a@b.com',
    );
  });

  it('re-reads the winner row when the create loses the unique-constraint race', async () => {
    repo.findByExternal
      .mockResolvedValueOnce(null) // initial lookup: not found
      .mockResolvedValueOnce(makeRow('user_winner', 'ext_1')); // post-conflict re-read
    repo.create.mockRejectedValue(new Error('duplicate key'));

    const id = await service.resolve('clerk', makeIdentity());

    expect(id).toBe('user_winner');
  });

  it('rethrows when create fails and no row appears on re-read', async () => {
    repo.findByExternal.mockResolvedValue(null);
    repo.create.mockRejectedValue(new Error('db down'));

    await expect(service.resolve('clerk', makeIdentity())).rejects.toThrow(
      'db down',
    );
  });
});
