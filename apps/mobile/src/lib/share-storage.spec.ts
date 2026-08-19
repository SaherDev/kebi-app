import {
  SHARE_KEYS,
  clearShareToken,
  readShareQueue,
  storeShareToken,
  storedShareTokenExpiry,
  writeShareQueue,
} from './share-storage';

// In-memory stand-in for the App Group suite. The real one is a native
// UserDefaults suite shared with the extension; the contract under test is what
// this module writes into it and how it reads back what the extension wrote.
const mockStore = new Map<string, string>();

jest.mock('./app-group', () => ({
  isAppGroupAvailable: () => true,
  getSharedItem: (key: string) => (mockStore.has(key) ? mockStore.get(key) : null),
  setSharedItem: (key: string, value: string) => {
    mockStore.set(key, value);
    return true;
  },
  removeSharedItem: (key: string) => {
    mockStore.delete(key);
    return true;
  },
}));

beforeEach(() => mockStore.clear());

describe('share token storage', () => {
  it('hands the extension a token and reads its expiry back', () => {
    const expiry = Date.now() + 90 * 86_400_000;

    expect(storeShareToken('kst_abc', expiry)).toBe(true);
    expect(mockStore.get(SHARE_KEYS.token)).toBe('kst_abc');
    expect(storedShareTokenExpiry()).toBe(expiry);
  });

  it('reports no expiry when there is no token', () => {
    expect(storedShareTokenExpiry()).toBeNull();
  });

  it('reports no expiry when the token is there but the expiry is junk', () => {
    mockStore.set(SHARE_KEYS.token, 'kst_abc');
    mockStore.set(SHARE_KEYS.tokenExpiresAt, 'whenever');
    expect(storedShareTokenExpiry()).toBeNull();
  });

  it('clears both halves on sign-out, so the extension cannot save', () => {
    storeShareToken('kst_abc', Date.now() + 1000);

    clearShareToken();

    expect(mockStore.has(SHARE_KEYS.token)).toBe(false);
    expect(mockStore.has(SHARE_KEYS.tokenExpiresAt)).toBe(false);
  });
});

describe('share queue', () => {
  const item = { raw_input: 'https://tiktok.com/@x/video/1', shared_at: 1_700_000_000_000 };

  it('round-trips what the extension queued', () => {
    writeShareQueue([item]);
    expect(readShareQueue()).toEqual([item]);
  });

  it('reads an empty queue when the extension has written nothing', () => {
    expect(readShareQueue()).toEqual([]);
  });

  it('survives a corrupt queue rather than blocking startup', () => {
    mockStore.set(SHARE_KEYS.queue, '{not json');
    expect(readShareQueue()).toEqual([]);
  });

  it('drops entries that are not shares, keeping the ones that are', () => {
    mockStore.set(
      SHARE_KEYS.queue,
      JSON.stringify([item, { raw_input: '   ', shared_at: 1 }, null, { shared_at: 1 }]),
    );
    expect(readShareQueue()).toEqual([item]);
  });

  it('removes the key entirely when the queue drains to empty', () => {
    writeShareQueue([item]);

    writeShareQueue([]);

    // Not an empty array left behind: the extension appends to this key, and a
    // stale "[]" is one more thing that can go wrong than no key at all.
    expect(mockStore.has(SHARE_KEYS.queue)).toBe(false);
  });

  it('writes back the remainder so a share added mid-drain is not swallowed', () => {
    const later = { raw_input: 'https://instagram.com/reel/2', shared_at: 1_700_000_001_000 };
    writeShareQueue([item, later]);

    // App drained the first, extension had appended the second meanwhile.
    writeShareQueue(readShareQueue().filter((q) => q.raw_input !== item.raw_input));

    expect(readShareQueue()).toEqual([later]);
  });
});
