import 'reflect-metadata';
import type { UserSettingsData } from '@kebi-app/shared';
import { ClaimStamper } from './claim-stamper';
import type { IdentityMetadataWriter } from './identity-metadata.writer';
import type { IdentityProvider } from './identity-provider.interface';
import type { UserIdentityService } from './user-identity.service';

const SETTINGS: UserSettingsData = {
  plan: 'homebody',
  ai_enabled: true,
  can_curate: false,
  movement_profile: null,
  about_me: null,
};

describe('ClaimStamper', () => {
  let metadataWriter: { stamp: jest.Mock };
  let userIdentity: { lookup: jest.Mock };
  let stamper: ClaimStamper;

  beforeEach(() => {
    metadataWriter = { stamp: jest.fn().mockResolvedValue(undefined) };
    userIdentity = { lookup: jest.fn() };
    stamper = new ClaimStamper(
      metadataWriter as unknown as IdentityMetadataWriter,
      { name: 'supabase', verify: jest.fn() } as IdentityProvider,
      userIdentity as unknown as UserIdentityService,
    );
  });

  it('stamps when the supplied id matches the identity mapping', async () => {
    userIdentity.lookup.mockResolvedValue('user_1');

    await stamper.stamp('ext_1', 'user_1', SETTINGS);

    expect(userIdentity.lookup).toHaveBeenCalledWith('supabase', 'ext_1');
    expect(metadataWriter.stamp).toHaveBeenCalledWith(
      'ext_1',
      expect.objectContaining({ internal_id: 'user_1' }),
    );
  });

  it('refuses to stamp an id the mapping does not own', async () => {
    // The identity-write invariant: an id read back from a stale or corrupted
    // token can never be written onto the account.
    userIdentity.lookup.mockResolvedValue('user_real');

    await expect(stamper.stamp('ext_1', 'user_bad', SETTINGS)).rejects.toThrow(
      /does not match the identity mapping/,
    );
    expect(metadataWriter.stamp).not.toHaveBeenCalled();
  });

  it('skips (no write, no throw) when no mapping exists — dev bypass identity', async () => {
    userIdentity.lookup.mockResolvedValue(null);

    await expect(stamper.stamp('ext_1', 'user_1', SETTINGS)).resolves.toBeUndefined();
    expect(metadataWriter.stamp).not.toHaveBeenCalled();
  });
});
