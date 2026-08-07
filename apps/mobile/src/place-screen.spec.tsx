import { useEffect } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import type { PlaceView, SavedPlaceView, UserPlace } from '@kebi-app/shared';
import PlaceScreen from './app/place';
import { PlaceDetailProvider, usePlaceDetail } from './components/place-detail-context';
import { getPlace, saveUserPlace } from './api/library';

// expo-router pulls in the native navigation runtime; mock the surface the
// screen uses (useRouter + useLocalSearchParams, which carries `id`/`from`).
// This spec lives in src/ (not src/app/) so expo-router's require.context over
// the routes dir doesn't bundle it — see home-screen.spec.
const mockParams: { from?: string; id?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

// The screen fetches by id (ADR-151) and saves through the same module.
jest.mock('./api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('./api/library', () => ({
  getPlace: jest.fn(),
  saveUserPlace: jest.fn(),
  updateUserPlace: jest.fn(),
  deleteUserPlace: jest.fn(),
}));
const mockedGetPlace = getPlace as jest.MockedFunction<typeof getPlace>;
const mockedSave = saveUserPlace as jest.MockedFunction<typeof saveUserPlace>;

const mockToast = jest.fn();
jest.mock('./components/toast-context', () => ({
  // `reserveTopAnchor` is what a sheet calls to push toasts above it — the
  // maps chooser mounts one, so the mock has to carry it too.
  useToast: () => ({ show: mockToast, reserveTopAnchor: () => () => undefined }),
  TOAST_DISMISS_MS: { withAction: 5000, plain: 2500 },
}));

// The screen raises the chat again when it was opened from one (ADR-052).
const mockOpenChat = jest.fn();
jest.mock('./components/chat-context', () => ({ useChat: () => ({ open: mockOpenChat }) }));

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
    claims: [],
    ...over,
  };
}

/** Seeds the place-detail context with `view` (rendered as a sibling of the screen). */
function Seed({ view }: { view: PlaceView }) {
  const { set } = usePlaceDetail();
  useEffect(() => set(view), [set, view]);
  return null;
}

function renderPlace(view: PlaceView | null) {
  return render(
    <PlaceDetailProvider>
      {view ? <Seed view={view} /> : null}
      <PlaceScreen />
    </PlaceDetailProvider>,
  );
}

describe('PlaceScreen', () => {
  beforeEach(() => {
    delete mockParams.from;
    delete mockParams.id;
    mockOpenChat.mockClear();
    mockToast.mockClear();
    mockedGetPlace.mockReset();
    mockedSave.mockReset();
  });

  it('renders the place from the selected view', () => {
    const { getByText, getByLabelText, queryByText } = renderPlace(makeView());
    expect(getByText('Saint Jardim')).toBeTruthy(); // title (source_label)
    expect(getByText('Shimokitazawa · portuguese')).toBeTruthy(); // eyebrow
    expect(getByText('vegetarian options')).toBeTruthy(); // dietary pill
    expect(getByText('liked')).toBeTruthy();
    expect(getByText('went')).toBeTruthy();
    expect(getByText('natural wine, 6 seats at the counter.')).toBeTruthy(); // note
    expect(getByLabelText('show on map')).toBeTruthy();
    expect(getByText('intimate')).toBeTruthy(); // atmosphere chip
    expect(getByText('private room')).toBeTruthy(); // feature chip
    expect(getByText('others')).toBeTruthy(); // catch-all section header
    expect(queryByText('reservable')).toBeNull(); // collapsed by default — chips hidden
    expect(getByText('wheelchair accessible: entrance')).toBeTruthy(); // accessibility line
    expect(getByText('@tokyofoodreport')).toBeTruthy(); // source handle
  });

  it('hides the note, sections, meta and map when their data is absent', () => {
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
    expect(queryByLabelText('show on map')).toBeNull(); // no provider id / coords
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

  it('opens the maps chooser from the map button', () => {
    const { getByLabelText, getByText } = renderPlace(makeView());
    fireEvent.press(getByLabelText('show on map'));
    expect(getByText('show on')).toBeTruthy();
    expect(getByText('google maps')).toBeTruthy();
  });

  describe('an unsaved place (ADR-151)', () => {
    /** The same place with no save behind it — what a chat venue tap opens. */
    const unsaved = (): PlaceView => ({ ...makeView(), user_data: null });

    it('offers save and drops every affordance that needs a user_place_id', () => {
      const { getByLabelText, queryByLabelText, queryByText, getByText } = renderPlace(unsaved());

      expect(getByLabelText('save')).toBeTruthy();
      // Place-driven content is untouched.
      expect(getByText('Saint Jardim')).toBeTruthy();
      expect(getByText('vegetarian options')).toBeTruthy();
      expect(getByText('intimate')).toBeTruthy();
      expect(getByLabelText('show on map')).toBeTruthy();
      // User-state affordances would PATCH/DELETE an id that does not exist.
      expect(queryByLabelText('more')).toBeNull();
      expect(queryByLabelText('edit')).toBeNull();
      expect(queryByText('add a note')).toBeNull();
      expect(queryByText('approve?')).toBeNull();
      expect(queryByText('@tokyofoodreport')).toBeNull(); // no provenance yet
      expect(queryByText('liked')).toBeNull();
    });

    it('says the place is new rather than rendering an empty screen', () => {
      // What a just-discovered place actually arrives as: a provider-built row
      // with its category and nothing else — every section below would hide.
      const fresh: PlaceView = {
        place: { ...makeView().place, tags: [], categories: ['restaurant'] },
        user_data: null,
        claims: [],
      };

      const { getByText, getByLabelText } = renderPlace(fresh);

      expect(getByText("kebi doesn't know much about this one yet")).toBeTruthy();
      expect(getByLabelText('save')).toBeTruthy();
    });

    it('stays quiet once the place has anything to show', () => {
      const { queryByText } = renderPlace({ ...makeView(), user_data: null });
      expect(queryByText("kebi doesn't know much about this one yet")).toBeNull();
    });

    it('saves with the place id alone and flips to the saved screen in place', async () => {
      const created = {
        user_place_id: 'u9',
        place_id: 'p1',
        approved: false,
        visited: false,
        liked: null,
        note: null,
        source: 'kebi',
        source_ref: null,
        source_label: null,
        saved_at: '2026-08-07T08:00:00Z',
        visited_at: null,
      } as UserPlace;
      mockedSave.mockResolvedValue(created);

      const { getByLabelText, queryByLabelText, getByText } = renderPlace(unsaved());
      fireEvent.press(getByLabelText('save'));

      // The retired card's recommendation_id/reason are 422s now — id only.
      expect(mockedSave).toHaveBeenCalledWith({}, { place_core_id: 'p1' });

      // 201 carries the created user-state, so no refetch is needed.
      await waitFor(() => expect(queryByLabelText('save')).toBeNull());
      expect(getByLabelText('more')).toBeTruthy();
      expect(getByText('add a note')).toBeTruthy();
      expect(getByText('approve?')).toBeTruthy();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'success', text: 'saved Saint Jardim' }),
      );
    });

    it('points at plans when the save hits the plan limit (403)', async () => {
      mockedSave.mockRejectedValue(Object.assign(new Error('limit'), { status: 403 }));

      const { getByLabelText } = renderPlace(unsaved());
      fireEvent.press(getByLabelText('save'));

      await waitFor(() => expect(mockToast).toHaveBeenCalled());
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'danger', action: expect.anything() }),
      );
      expect(getByLabelText('save')).toBeTruthy(); // still unsaved
    });
  });

  describe('resolving the place', () => {
    it('fetches by id when nothing seeded it — the chat venue tap', async () => {
      mockParams.id = 'p1';
      mockedGetPlace.mockResolvedValue({ ...makeView(), user_data: null });

      const { getByLabelText, findByText } = renderPlace(null);

      expect(await findByText('Saint Jardim')).toBeTruthy();
      expect(mockedGetPlace).toHaveBeenCalledWith({}, 'p1');
      expect(getByLabelText('save')).toBeTruthy();
    });

    it('keeps showing a seeded place when the refresh fails', async () => {
      mockParams.id = 'p1';
      mockedGetPlace.mockRejectedValue(new Error('offline'));

      const { getByText } = renderPlace(makeView());

      await waitFor(() => expect(mockedGetPlace).toHaveBeenCalled());
      // Blanking a screen the user is already reading is worse than a stale one.
      expect(getByText('Saint Jardim')).toBeTruthy();
    });

    it('says so when there is no seed and the fetch fails', async () => {
      mockParams.id = 'gone';
      mockedGetPlace.mockRejectedValue(new Error('404'));

      const { findByText } = renderPlace(null);

      expect(await findByText("couldn't open that place")).toBeTruthy();
    });
  });

  describe('opened from chat (ADR-052)', () => {
    it('raises the chat again when the screen goes away', () => {
      mockParams.from = 'chat';
      const { unmount } = renderPlace(makeView());

      expect(mockOpenChat).not.toHaveBeenCalled(); // not while the card is up

      unmount(); // back button *or* the iOS swipe-back gesture
      expect(mockOpenChat).toHaveBeenCalledTimes(1);
      // No seed — the transcript survives above the overlay, so reopening must
      // not re-send anything.
      expect(mockOpenChat).toHaveBeenCalledWith();
    });

    it('leaves the chat alone when the place was opened from the library', () => {
      const { unmount } = renderPlace(makeView());
      unmount();
      expect(mockOpenChat).not.toHaveBeenCalled();
    });
  });
});
