import { render, fireEvent } from '@testing-library/react-native';
import type { SavedPlaceView } from '@kebi-app/shared';
import { LibraryPlaceCard } from './library-place-card';
import { PlaceDetailProvider } from './place-detail-context';
import { PlaceActionsProvider } from './place-actions-context';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { LongPress: () => mockChain() },
}));
jest.mock('../lib/haptics', () => ({ triggerHaptic: jest.fn() }));

const view: SavedPlaceView = {
  place: {
    id: 'p1',
    provider_id: 'google:ChIJabc',
    place_name: 'Saint Jardim',
    place_name_aliases: [],
    categories: ['restaurant'],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
  },
  user_data: {
    user_place_id: 'u1',
    place_id: 'p1',
    approved: true,
    visited: false,
    liked: null,
    note: null,
    source: 'tiktok',
    source_ref: 'https://www.tiktok.com/@tokyofoodreport/video/1',
    source_label: 'Saint Jardim',
    saved_at: '2026-05-01T08:00:00Z',
    visited_at: null,
  },
  claims: [],
};

function renderCard() {
  return render(
    <PlaceActionsProvider>
      <PlaceDetailProvider>
        <LibraryPlaceCard view={view} />
      </PlaceDetailProvider>
    </PlaceActionsProvider>,
  );
}

describe('LibraryPlaceCard', () => {
  beforeEach(() => mockPush.mockClear());

  it('navigates to the place page on tap (path A)', () => {
    const { getByRole } = renderCard();
    fireEvent.press(getByRole('button', { name: 'Saint Jardim' }));
    expect(mockPush).toHaveBeenCalledWith('/place');
  });
});
