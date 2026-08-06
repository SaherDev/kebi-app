import { renderHook, waitFor } from '@testing-library/react-native';
import type { ChatEntity, SavedPlaceView } from '@kebi-app/shared';
import { LIBRARY_LOOKUP_MAX_PAGES } from '../lib/library-config';
import { findSavedPlace, useOpenChatVenue } from './use-open-chat-venue';
import { getLibrary } from '../api/library';

const order: string[] = [];
const mockPush = jest.fn(() => order.push('push'));
const mockSet = jest.fn(() => order.push('set'));
const mockShow = jest.fn();

jest.mock('../api/library', () => ({ getLibrary: jest.fn() }));
jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('./place-detail-context', () => ({ usePlaceDetail: () => ({ set: mockSet }) }));
jest.mock('./toast-context', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const mockedGetLibrary = getLibrary as jest.MockedFunction<typeof getLibrary>;

const view = (id: string) => ({ place: { id }, user_data: {}, claims: [] }) as SavedPlaceView;

const VAULT: ChatEntity = {
  kind: 'venue',
  key: 'vault-id',
  name: 'Vault Nightclub Bali',
  uri: 'kebi://venue/vault-id',
  icon: '🎶',
};

/** A paged library: `pages[n]` is the nth page's places. */
function pager(pages: SavedPlaceView[][]) {
  const calls: (string | undefined)[] = [];
  const fetchPage = async (cursor?: string) => {
    calls.push(cursor);
    const index = cursor ? Number(cursor) : 0;
    return {
      places: pages[index] ?? [],
      next_cursor: index + 1 < pages.length ? String(index + 1) : null,
    };
  };
  return { fetchPage, calls };
}

describe('findSavedPlace', () => {
  it('finds a place on the first page without paging further', async () => {
    const { fetchPage, calls } = pager([[view('a'), view('b')], [view('c')]]);

    await expect(findSavedPlace(fetchPage, 'b')).resolves.toMatchObject({ place: { id: 'b' } });
    expect(calls).toEqual([undefined]); // one request, no cursor follow-up
  });

  it('follows the cursor to a later page', async () => {
    const { fetchPage, calls } = pager([[view('a')], [view('b')], [view('c')]]);

    await expect(findSavedPlace(fetchPage, 'c')).resolves.toMatchObject({ place: { id: 'c' } });
    expect(calls).toEqual([undefined, '1', '2']);
  });

  it('returns null when the library runs out', async () => {
    const { fetchPage } = pager([[view('a')], [view('b')]]);
    await expect(findSavedPlace(fetchPage, 'missing')).resolves.toBeNull();
  });

  it('stops at the page cap instead of sweeping a large stash', async () => {
    // More pages than the cap; the target sits past it.
    const pages = Array.from({ length: LIBRARY_LOOKUP_MAX_PAGES + 3 }, (_, i) => [view(`p${i}`)]);
    const { fetchPage, calls } = pager(pages);

    await expect(findSavedPlace(fetchPage, `p${LIBRARY_LOOKUP_MAX_PAGES + 2}`)).resolves.toBeNull();
    expect(calls).toHaveLength(LIBRARY_LOOKUP_MAX_PAGES);
  });
});

describe('useOpenChatVenue', () => {
  beforeEach(() => {
    order.length = 0;
    mockPush.mockClear();
    mockSet.mockClear();
    mockShow.mockClear();
    mockedGetLibrary.mockReset();
  });

  const open = (closeChat: () => void, entity: ChatEntity = VAULT) => {
    const { result } = renderHook(() => useOpenChatVenue(closeChat));
    result.current(entity);
  };

  it('closes the chat BEFORE pushing the place — chat is an overlay above the stack', async () => {
    mockedGetLibrary.mockResolvedValue({
      places: [view('vault-id')],
      next_cursor: null,
    } as Awaited<ReturnType<typeof getLibrary>>);
    const closeChat = jest.fn(() => order.push('close'));

    open(closeChat);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/place'));
    // Pushing under an open chat lands the card behind it — the tap then looks
    // like it did nothing, which is exactly the bug this order prevents.
    expect(order).toEqual(['set', 'close', 'push']);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('says so and stays put when the venue is not in the library', async () => {
    mockedGetLibrary.mockResolvedValue({
      places: [view('someone-else')],
      next_cursor: null,
    } as Awaited<ReturnType<typeof getLibrary>>);
    const closeChat = jest.fn();

    open(closeChat);

    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    expect(mockShow.mock.calls[0][0]).toMatchObject({ text: 'chat.venueUnavailable' });
    expect(closeChat).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('surfaces the same line when the lookup itself fails', async () => {
    mockedGetLibrary.mockRejectedValue(new Error('offline'));

    open(jest.fn());

    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('ignores an area — only venues have a card to open', async () => {
    open(jest.fn(), { ...VAULT, kind: 'area', uri: 'kebi://area/id/bali' });

    expect(mockedGetLibrary).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
