import { renderHook, waitFor } from '@testing-library/react-native';
import { useStash } from './use-stash';

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(cb, [cb]);
  },
}));
jest.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const mockGetLibrary = jest.fn();
const mockGetLibraryAreas = jest.fn();
jest.mock('../api/library', () => ({
  getLibrary: (...args: unknown[]) => mockGetLibrary(...args),
  getLibraryAreas: (...args: unknown[]) => mockGetLibraryAreas(...args),
}));

const mockLocation = jest.fn();
const mockCountry = jest.fn();
jest.mock('../lib/location', () => ({
  getDeviceLocation: () => mockLocation(),
  getDeviceCountryCode: () => mockCountry(),
}));

const area = (key: string, name: string) => ({
  key,
  name,
  uri: `kebi://area/${key}`,
  icon: null,
  parent: null,
});
const row = (id: string) => ({ user_data: { user_place_id: id } });
const page = (ids: string[], total = 37) => ({
  places: ids.map(row),
  next_cursor: null,
  total,
  filtered_total: total,
});

describe('useStash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.mockResolvedValue({ lat: -8.65, lng: 115.13 });
    mockCountry.mockResolvedValue('id');
    mockGetLibraryAreas.mockResolvedValue({
      areas: [
        { area: area('kg/naryn', 'Naryn Region'), count: 9 },
        { area: area('id/bali/canggu', 'Canggu'), count: 5 },
      ],
    });
    // Unfiltered read first, then the scoped one.
    mockGetLibrary.mockResolvedValueOnce(page(['newest1', 'newest2', 'newest3']));
    mockGetLibrary.mockResolvedValueOnce(page(['canggu1', 'canggu2']));
  });

  it("previews the Library's first group, not the newest saves", async () => {
    const { result } = renderHook(() => useStash());

    await waitFor(() => expect(result.current.views).toHaveLength(2));
    expect(result.current.views.map((v) => v.user_data.user_place_id)).toEqual([
      'canggu1',
      'canggu2',
    ]);
    // Naryn is bigger, but you're in Indonesia — the same rule the Library uses.
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({ area: 'id/bali/canggu' });
  });

  it('reports the whole stash as the total, not the preview', async () => {
    const { result } = renderHook(() => useStash());

    await waitFor(() => expect(result.current.total).toBe(37));
  });

  it('falls back to newest when the group turns up empty', async () => {
    mockGetLibrary.mockReset();
    mockGetLibrary.mockResolvedValueOnce(page(['newest1']));
    mockGetLibrary.mockResolvedValueOnce(page([]));

    const { result } = renderHook(() => useStash());

    await waitFor(() => expect(result.current.views).toHaveLength(1));
    expect(result.current.views[0].user_data.user_place_id).toBe('newest1');
  });

  it('falls back to newest when there is no location', async () => {
    mockLocation.mockResolvedValue(null);
    mockGetLibrary.mockReset();
    mockGetLibrary.mockResolvedValueOnce(page(['newest1']));
    mockGetLibrary.mockResolvedValueOnce(page(['big1']));

    const { result } = renderHook(() => useStash());

    // Still groups — it just orders by size, so the biggest group leads.
    await waitFor(() => expect(mockGetLibrary).toHaveBeenCalledTimes(2));
    expect(mockGetLibrary.mock.calls[1][1]).toMatchObject({ area: 'kg/naryn' });
  });

  it('falls back to newest when the distribution fails', async () => {
    mockGetLibraryAreas.mockRejectedValue(new Error('offline'));
    mockGetLibrary.mockReset();
    mockGetLibrary.mockResolvedValueOnce(page(['newest1', 'newest2']));

    const { result } = renderHook(() => useStash());

    await waitFor(() => expect(result.current.views).toHaveLength(2));
    expect(result.current.error).toBe(false);
  });

  it('surfaces an error when the plain read fails', async () => {
    mockGetLibrary.mockReset();
    mockGetLibrary.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useStash());

    await waitFor(() => expect(result.current.error).toBe(true));
  });
});
