import { detectChannel, isValidEmail, isValidPhone } from './detect-channel';

describe('detectChannel', () => {
  it('treats an empty or whitespace-only string as empty', () => {
    expect(detectChannel('')).toBe('empty');
    expect(detectChannel('   ')).toBe('empty');
  });

  it('detects email by the presence of @', () => {
    expect(detectChannel('a@b.com')).toBe('email');
    expect(detectChannel('user123@example.io')).toBe('email');
  });

  it('detects phone for a leading + or digits/spaces/dashes only', () => {
    expect(detectChannel('+1 555-0123')).toBe('phone');
    expect(detectChannel('5550123')).toBe('phone');
    expect(detectChannel('555 012-3')).toBe('phone');
  });

  it('lets @ win over a phone-like shape', () => {
    expect(detectChannel('+1@x')).toBe('email');
  });

  it('falls back to ambiguous for anything else', () => {
    expect(detectChannel('saher')).toBe('ambiguous');
    expect(detectChannel('123abc')).toBe('ambiguous');
  });
});

describe('isValidEmail', () => {
  it('accepts a well-formed address', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail(' user@example.io ')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('accepts E.164 with country code (ignoring spaces/dashes)', () => {
    expect(isValidPhone('+44 7911 123456')).toBe(true);
    expect(isValidPhone('+1 555-012-3456')).toBe(true);
  });
  it('rejects a local number with no country code', () => {
    expect(isValidPhone('0525293733')).toBe(false);
    expect(isValidPhone('525293733')).toBe(false);
    expect(isValidPhone('+0123')).toBe(false);
  });
});
