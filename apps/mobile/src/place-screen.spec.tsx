import { useEffect } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { SavedPlaceView } from '@kebi-app/shared';
import PlaceScreen from './app/place';
import { PlaceDetailProvider, usePlaceDetail } from './components/place-detail-context';

// expo-router pulls in the native navigation runtime; mock the surface the
// screen uses (useRouter). This spec lives in src/ (not src/app/) so expo-router's
// require.context over the routes dir doesn't bundle it — see home-screen.spec.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

// Chainable no-op for Gesture.Pan().activeOffsetY().onUpdate().onEnd().
const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { Pan: () => mockChain() },
}));

jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

function makeView(over: Partial<SavedPlaceView> = {}): SavedPlaceView {
  return {
    place: {
      id: 'p1',
      provider_id: 'google:ChIJabc',
      place_name: 'Saint Jardim',
      place_name_aliases: [],
      categories: ['restaurant'],
      tags: [
        { type: 'cuisine', value: 'Portuguese', source: 'llm' },
        { type: 'price', value: 'expensive', source: 'llm' },
        { type: 'dietary', value: 'vegetarian_options', source: 'llm' },
        { type: 'atmosphere', value: 'intimate', source: 'llm' },
        { type: 'feature', value: 'private_room', source: 'llm' },
        { type: 'service', value: 'reservable', source: 'llm' },
        { type: 'accessibility', value: 'wheelchair_entrance', source: 'llm' },
      ],
      location: {
        lat: 35.6,
        lng: 139.6,
        address: null,
        neighborhood: 'Shimokitazawa',
        city: 'Tokyo',
        country: 'JP',
      },
      created_at: null,
      refreshed_at: null,
    },
    user_data: {
      user_place_id: 'u1',
      place_id: 'p1',
      approved: true,
      visited: true,
      liked: true,
      note: 'natural wine, 6 seats at the counter.',
      source: 'tiktok',
      source_ref: 'https://www.tiktok.com/@tokyofoodreport/video/1',
      source_label: 'Saint Jardim',
      saved_at: '2026-05-01T08:00:00Z',
      visited_at: null,
    },
    ...over,
  };
}

/** Seeds the place-detail context with `view` (rendered as a sibling of the screen). */
function Seed({ view }: { view: SavedPlaceView }) {
  const { set } = usePlaceDetail();
  useEffect(() => set(view), [set, view]);
  return null;
}

function renderPlace(view: SavedPlaceView) {
  return render(
    <PlaceDetailProvider>
      <Seed view={view} />
      <PlaceScreen />
    </PlaceDetailProvider>,
  );
}

describe('PlaceScreen', () => {
  it('renders the place from the selected view', () => {
    const { getByText, getByLabelText, queryByText } = renderPlace(makeView());
    expect(getByText('Saint Jardim')).toBeTruthy(); // title (source_label)
    expect(getByText('Shimokitazawa · portuguese')).toBeTruthy(); // eyebrow
    expect(getByText('vegetarian options')).toBeTruthy(); // dietary pill
    expect(getByText('liked')).toBeTruthy();
    expect(getByText('went')).toBeTruthy();
    expect(getByText('natural wine, 6 seats at the counter.')).toBeTruthy(); // note
    expect(getByLabelText('directions')).toBeTruthy();
    expect(getByText('intimate')).toBeTruthy(); // atmosphere chip
    expect(getByText('private room')).toBeTruthy(); // feature chip
    expect(getByText('others')).toBeTruthy(); // catch-all section header
    expect(queryByText('reservable')).toBeNull(); // collapsed by default — chips hidden
    expect(getByText('wheelchair accessible: entrance')).toBeTruthy(); // accessibility line
    expect(getByText('@tokyofoodreport')).toBeTruthy(); // source handle
  });

  it('hides the note, sections, meta and directions when their data is absent', () => {
    const { queryByText, queryByLabelText } = renderPlace(
      makeView({
        place: {
          id: 'p2',
          provider_id: null,
          place_name: 'Bare Place',
          place_name_aliases: [],
          categories: ['park'],
          tags: [],
          location: null,
          created_at: null,
          refreshed_at: null,
        },
        user_data: {
          user_place_id: 'u2',
          place_id: 'p2',
          approved: true,
          visited: false,
          liked: null,
          note: null,
          source: 'manual',
          source_ref: null,
          source_label: null,
          saved_at: '2026-05-01T08:00:00Z',
          visited_at: null,
        },
      }),
    );
    expect(queryByText('Bare Place')).toBeTruthy(); // title still renders
    expect(queryByText('atmosphere')).toBeNull();
    expect(queryByText('features')).toBeNull();
    expect(queryByLabelText('directions')).toBeNull(); // no provider id / coords
    expect(queryByText('liked')).toBeNull();
    expect(queryByText('went')).toBeNull();
  });

  it('reveals the "others" tags when the section is expanded', () => {
    const { getByRole, queryByText, getByText } = renderPlace(makeView());
    expect(queryByText('reservable')).toBeNull();
    fireEvent.press(getByRole('button', { name: 'others' }));
    expect(getByText('reservable')).toBeTruthy();
  });

  it('opens the action sheet from the ••• button', () => {
    const { getByLabelText, getByText } = renderPlace(makeView());
    fireEvent.press(getByLabelText('more'));
    expect(getByText('looks right')).toBeTruthy();
    expect(getByText('forget this place')).toBeTruthy();
  });

  it('opens the maps chooser from the directions button', () => {
    const { getByLabelText, getByText } = renderPlace(makeView());
    fireEvent.press(getByLabelText('directions'));
    expect(getByText('open directions in')).toBeTruthy();
    expect(getByText('google maps')).toBeTruthy();
  });
});
