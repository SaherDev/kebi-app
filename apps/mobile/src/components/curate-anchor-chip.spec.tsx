import { render, screen, fireEvent } from '@testing-library/react-native';
import { CurateAnchorChip } from './curate-anchor-chip';

const mockSearch = jest.fn();
jest.mock('./use-entity-search', () => ({
  useEntitySearch: (q: string) => mockSearch(q),
}));

const hit = (over: Record<string, unknown> = {}) => ({
  type: 'area',
  place_id: null,
  area_id: 'token',
  name: 'Canggu',
  emoji: '🏄',
  subtitle: 'neighbourhood · Bali, ID',
  ...over,
});

const props = {
  anchor: { emoji: '🍜', name: 'Kamachiku', context: 'nezu' },
  searching: false,
  query: '',
  onQueryChange: jest.fn(),
  onStartSearch: jest.fn(),
  onCancelSearch: jest.fn(),
  onPick: jest.fn(),
};

describe('CurateAnchorChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch.mockReturnValue({ results: [], loading: false, empty: false });
  });

  describe('collapsed', () => {
    it('shows what the prose is about, and offers to change it', () => {
      render(<CurateAnchorChip {...props} />);

      expect(screen.getByText('Kamachiku · nezu')).toBeTruthy();
      expect(screen.getByText('change')).toBeTruthy();
    });

    it('says "pick" when nothing is anchored yet', () => {
      render(<CurateAnchorChip {...props} anchor={null} />);

      expect(screen.getByText('a place or area')).toBeTruthy();
      expect(screen.getByText('pick')).toBeTruthy();
    });

    it('does not search while collapsed', () => {
      render(<CurateAnchorChip {...props} />);

      expect(mockSearch).toHaveBeenCalledWith('');
    });

    it('opens the search when tapped', () => {
      render(<CurateAnchorChip {...props} />);
      fireEvent.press(screen.getByLabelText('Kamachiku'));

      expect(props.onStartSearch).toHaveBeenCalled();
    });
  });

  describe('searching', () => {
    it('renders the hits, areas as they came (order is the server\'s)', () => {
      mockSearch.mockReturnValue({
        results: [hit(), hit({ type: 'place', name: 'Canggu Coffee', subtitle: 'Canggu, Bali' })],
        loading: false,
        empty: false,
      });
      render(<CurateAnchorChip {...props} searching query="cang" />);

      expect(screen.getByText('Canggu')).toBeTruthy();
      expect(screen.getByText('Canggu Coffee')).toBeTruthy();
      // One list, no type toggle: the kind shows in the glyph and sub-label.
      expect(screen.getByText('neighbourhood · Bali, ID')).toBeTruthy();
    });

    it('hands the picked hit up', () => {
      const picked = hit();
      mockSearch.mockReturnValue({ results: [picked], loading: false, empty: false });
      render(<CurateAnchorChip {...props} searching query="cang" />);

      fireEvent.press(screen.getByLabelText('Canggu'));

      expect(props.onPick).toHaveBeenCalledWith(picked);
    });

    it('shows an empty line when a query came back with nothing', () => {
      mockSearch.mockReturnValue({ results: [], loading: false, empty: true });
      render(<CurateAnchorChip {...props} searching query="zzzz" />);

      expect(screen.getByText('nothing by that name')).toBeTruthy();
    });

    it('cancels back to the previous anchor', () => {
      render(<CurateAnchorChip {...props} searching query="cang" />);
      fireEvent.press(screen.getByLabelText('close'));

      expect(props.onCancelSearch).toHaveBeenCalled();
    });
  });
});
