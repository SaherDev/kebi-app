import { areaIdFromUri } from './area-link';

describe('areaIdFromUri', () => {
  it('lifts the token off an area uri', () => {
    expect(areaIdFromUri('kebi://area/aWQvYmFsaS9jYW5nZ3U')).toBe('aWQvYmFsaS9jYW5nZ3U');
  });

  it('returns the token verbatim — the codec is kebi\'s, not ours', () => {
    // No decoding, no validation: whatever kebi minted goes back as-is, and a
    // token this build doesn't recognise is kebi's 404 to answer.
    expect(areaIdFromUri('kebi://area/not-a-real-token')).toBe('not-a-real-token');
  });

  it('is not fooled by a venue uri', () => {
    expect(areaIdFromUri('kebi://venue/c0ffee00')).toBeNull();
  });

  it('returns null for an area uri with no token', () => {
    expect(areaIdFromUri('kebi://area/')).toBeNull();
  });
});
