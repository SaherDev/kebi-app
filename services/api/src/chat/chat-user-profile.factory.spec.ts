import type { AuthUser, NormalizedIdentity } from '@kebi-app/shared';
import { CALL_ME_MAX_LENGTH } from '@kebi-app/shared';
import { ChatUserProfileFactory } from './chat-user-profile.factory';

const USER: AuthUser = { id: 'user_1', ai_enabled: true };
const IDENTITY: NormalizedIdentity = { externalId: 'ext_1', claims: {} };

describe('ChatUserProfileFactory', () => {
  const factory = new ChatUserProfileFactory();

  it('falls back to the account display name when call_me is unset', () => {
    expect(factory.from({ ...IDENTITY, name: 'Saher' }, USER)).toEqual({
      call_me: 'Saher',
      home_country: null,
      about: null,
    });
  });

  it('clamps an over-long name rather than failing the turn on a 422', () => {
    const name = 'n'.repeat(CALL_ME_MAX_LENGTH + 10);

    expect(factory.from({ ...IDENTITY, name }, USER)?.call_me).toHaveLength(CALL_ME_MAX_LENGTH);
  });

  it('reads the whole block off the stamped claim', () => {
    const about_me = { call_me: 'Saher', home_country: 'AE', about: 'I do not drink.' };

    expect(factory.from(IDENTITY, { ...USER, about_me })).toEqual(about_me);
  });

  it('prefers a stored call_me over the account display name', () => {
    const about_me = { call_me: 'Sah', home_country: null, about: null };

    expect(factory.from({ ...IDENTITY, name: 'Saher' }, { ...USER, about_me })?.call_me).toBe(
      'Sah',
    );
  });

  it('omits the block entirely when we know nothing', () => {
    expect(factory.from(IDENTITY, USER)).toBeNull();
  });

  it('omits the block when the name is whitespace and the about-me is empty', () => {
    expect(
      factory.from(
        { ...IDENTITY, name: '  ' },
        { ...USER, about_me: { call_me: null, home_country: null, about: null } },
      ),
    ).toBeNull();
  });
});
