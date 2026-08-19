import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { WhileYouWereAway } from './while-you-were-away';
import type { ShareResultRow } from './use-share-results';
import { SHARE_CARD_LIMIT } from '../lib/share-config';

const mockRows: { current: ShareResultRow[] } = { current: [] };
jest.mock('./use-share-results', () => ({
  useShareResults: () => ({
    rows: mockRows.current,
    dismiss: jest.fn(),
    clear: jest.fn(),
    retry: jest.fn(),
  }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockFold = { folded: false };
jest.mock('../lib/share-fold', () => ({
  getShareFolded: () => Promise.resolve(mockFold.folded),
  setShareFolded: (next: boolean) => {
    mockFold.folded = next;
    return Promise.resolve();
  },
}));

const landed = (id: string, name: string, sharedAt: number): ShareResultRow => ({
  id,
  rawInput: `https://vt.tiktok.com/${id}`,
  label: `tiktok · ${id}`,
  source: 'tiktok',
  sharedAt,
  state: 'landed',
  places: [{ id: `p-${id}`, name, icon: null, categories: [] }],
  dismissed: false,
});

const failed = (id: string, sharedAt: number): ShareResultRow => ({
  ...landed(id, 'ignored', sharedAt),
  state: 'failed',
  places: [],
  failureReason: 'no_candidates',
});

beforeEach(() => {
  mockFold.folded = false;
  mockRows.current = [];
  mockPush.mockReset();
});

describe('WhileYouWereAway', () => {
  it('shows nothing when no links came in', async () => {
    const { toJSON } = render(<WhileYouWereAway />);
    await waitFor(() => expect(toJSON()).toBeNull());
  });

  it('caps the card and defers the rest to the screen', async () => {
    // A notice, not a feed: home shows three lines and a door.
    mockRows.current = [
      landed('a', 'Kayu', 5),
      landed('b', 'Melasti', 4),
      landed('c', 'Savaya', 3),
      landed('d', 'Crate', 2),
      landed('e', 'Fuglen', 1),
    ];

    const { getByText, queryByText } = render(<WhileYouWereAway />);

    await waitFor(() => expect(getByText('Kayu')).toBeTruthy());
    expect(queryByText('Fuglen')).toBeNull();
    expect(getByText(`show all ${mockRows.current.length}`)).toBeTruthy();
    expect(SHARE_CARD_LIMIT).toBe(3);
  });

  it('keeps a failure on the card when places would have crowded it out', async () => {
    // The one line that can actually be lost — every landed place is also in
    // the stash, a failed share is nowhere else.
    mockRows.current = [
      landed('a', 'Kayu', 9),
      landed('b', 'Melasti', 8),
      landed('c', 'Savaya', 7),
      failed('old', 1),
    ];

    const { getByText } = render(<WhileYouWereAway />);

    await waitFor(() => expect(getByText('no place found')).toBeTruthy());
  });

  it('opens the screen from the footer', async () => {
    mockRows.current = [
      landed('a', 'Kayu', 4),
      landed('b', 'Melasti', 3),
      landed('c', 'Savaya', 2),
      landed('d', 'Crate', 1),
    ];

    const { getByText } = render(<WhileYouWereAway />);
    await waitFor(() => expect(getByText('show all 4')).toBeTruthy());

    fireEvent.press(getByText('show all 4'));

    expect(mockPush).toHaveBeenCalledWith('/shares');
  });

  it('folds to a single row that counts what is inside it', async () => {
    mockRows.current = [landed('a', 'Kayu', 2), failed('b', 1)];

    const { getByText, getByLabelText, queryByText } = render(<WhileYouWereAway />);
    await waitFor(() => expect(getByText('Kayu')).toBeTruthy());

    fireEvent.press(getByLabelText('fold'));

    await waitFor(() => expect(getByText("1 saved · 1 didn't")).toBeTruthy());
    expect(queryByText('Kayu')).toBeNull();
  });

  it('folded, the card is a door rather than a lid', async () => {
    // Tapping it opens the history — folding and "show all" are one idea.
    mockFold.folded = true;
    mockRows.current = [landed('a', 'Kayu', 1)];

    const { getByText } = render(<WhileYouWereAway />);
    await waitFor(() => expect(getByText('1 saved')).toBeTruthy());

    fireEvent.press(getByText('1 saved'));

    expect(mockPush).toHaveBeenCalledWith('/shares');
  });
});
