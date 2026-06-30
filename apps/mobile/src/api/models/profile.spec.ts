import { UserProfile, UserProfileSchema } from './profile';
import { validate } from '../validate';
import { SchemaValidationError } from '../validate';

describe('UserProfileSchema', () => {
  it('transforms a valid payload into a UserProfile instance', () => {
    const res = validate(
      UserProfileSchema,
      { name: 'saher', email: 'saher@kebi.app', plan: 'explorer' },
      'UserProfile',
    );
    expect(res).toBeInstanceOf(UserProfile);
    expect(res).toMatchObject({ name: 'saher', email: 'saher@kebi.app', plan: 'explorer' });
  });

  it('accepts each plan tier', () => {
    for (const plan of ['homebody', 'explorer', 'local_legend'] as const) {
      const res = validate(UserProfileSchema, { name: '', email: '', plan }, 'UserProfile');
      expect(res.plan).toBe(plan);
    }
  });

  it('rejects an unknown plan', () => {
    expect(() =>
      validate(UserProfileSchema, { name: 'x', email: 'y', plan: 'nope' }, 'UserProfile'),
    ).toThrow(SchemaValidationError);
  });

  it('rejects a non-string name', () => {
    expect(() =>
      validate(UserProfileSchema, { name: 5, email: 'y', plan: 'homebody' }, 'UserProfile'),
    ).toThrow(SchemaValidationError);
  });
});
