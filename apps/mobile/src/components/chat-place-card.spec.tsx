import { render, fireEvent, waitFor } from '@testing-library/react-native';
import type { SseToolResult } from '@kebi-app/shared';
import { ChatPlaceCard } from './chat-place-card';
import { SavedPlacesProvider } from './saved-places-context';
import { sendSignal } from '../api/signal';
import { saveUserPlace, deleteUserPlace } from '../api/library';

// Avoid the real api client (createApiClient throws without EXPO_PUBLIC_API_URL).
jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('../lib/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('../api/signal', () => ({ sendSignal: jest.fn() }));
jest.mock('../api/library', () => ({ saveUserPlace: jest.fn(), deleteUserPlace: jest.fn() }));

const mockedSendSignal = sendSignal as jest.MockedFunction<typeof sendSignal>;
const mockedSaveUserPlace = saveUserPlace as jest.MockedFunction<typeof saveUserPlace>;
const mockedDeleteUserPlace = deleteUserPlace as jest.MockedFunction<typeof deleteUserPlace>;

function place(name: string, id: string | null = null, provider_id: string | null = null) {
  return {
    id,
    provider_id,
    place_name: name,
    place_name_aliases: [],
    categories: ['restaurant'],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
  };
}

function toolResult(candidates: unknown[], recommendation_id = 'rec_1'): SseToolResult {
  return {
    tool: 'discover_places',
    tool_call_id: 'c1',
    payload: { candidates, recommendation_id },
  } as SseToolResult;
}

// Render inside a real SavedPlacesProvider so saved-state (add/isSaved) updates.
const renderCard = (toolResults: SseToolResult[]) =>
  render(
    <SavedPlacesProvider>
      <ChatPlaceCard toolResults={toolResults} />
    </SavedPlacesProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockedSaveUserPlace.mockResolvedValue({ user_place_id: 'up_1' } as never);
  mockedDeleteUserPlace.mockResolvedValue(undefined);
});

describe('ChatPlaceCard', () => {
  it('renders the primary pick, its reason, the actions, and a swap row', () => {
    const tr = toolResult([
      { place: place('Contact Tokyo'), source: 'discovered', reason: 'great deep house' },
      { place: place('Bar Trench'), source: 'discovered', reason: null },
    ]);

    const { getByText } = renderCard([tr]);

    expect(getByText('Contact Tokyo')).toBeTruthy();
    expect(getByText('great deep house')).toBeTruthy();
    expect(getByText('good pick')).toBeTruthy();
    expect(getByText('Bar Trench')).toBeTruthy(); // swap
  });

  it('promotes a swap to the recommendation when tapped', () => {
    const tr = toolResult([
      { place: place('Contact Tokyo'), source: 'discovered', reason: 'deep house' },
      { place: place('Bar Trench'), source: 'discovered', reason: 'cocktails' },
    ]);

    const { getByText, queryByText, getByLabelText } = renderCard([tr]);

    expect(getByText('deep house')).toBeTruthy();
    expect(queryByText('cocktails')).toBeNull();

    fireEvent.press(getByLabelText('Bar Trench'));

    expect(getByText('cocktails')).toBeTruthy();
    expect(queryByText('deep house')).toBeNull();
  });

  it('shows a no-match line when there are no candidates', () => {
    const { getByText } = renderCard([toolResult([])]);
    expect(getByText("couldn't find a match")).toBeTruthy();
  });

  it('posts a recommendation_accepted signal on "good pick"', async () => {
    const tr = toolResult(
      [{ place: place('Contact Tokyo', 'place_1'), source: 'discovered', reason: null }],
      'rec_9',
    );
    const { getByLabelText } = renderCard([tr]);

    fireEvent.press(getByLabelText('good pick'));

    await waitFor(() =>
      expect(mockedSendSignal).toHaveBeenCalledWith(expect.anything(), {
        signal_type: 'recommendation_accepted',
        recommendation_id: 'rec_9',
        place_core_id: 'place_1',
      }),
    );
  });

  it('posts a recommendation_rejected signal on "not for me"', async () => {
    const tr = toolResult([
      { place: place('Contact Tokyo', 'place_1'), source: 'discovered', reason: null },
    ]);
    const { getByLabelText } = renderCard([tr]);

    fireEvent.press(getByLabelText('not for me'));

    await waitFor(() =>
      expect(mockedSendSignal).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal_type: 'recommendation_rejected', place_core_id: 'place_1' }),
      ),
    );
  });

  it('saves the place and flips the button to a saved state on "save it"', async () => {
    const tr = toolResult([
      { place: place('Contact Tokyo', 'place_1', 'google:abc'), source: 'discovered', reason: null },
    ]);
    const { getByLabelText, getByText, queryByLabelText } = renderCard([tr]);

    fireEvent.press(getByLabelText('save it'));

    await waitFor(() =>
      expect(mockedSaveUserPlace).toHaveBeenCalledWith(expect.anything(), {
        place_core_id: 'place_1',
        recommendation_id: 'rec_1',
      }),
    );
    // The save button is replaced by the inert "saved" slot.
    await waitFor(() => expect(getByText('saved')).toBeTruthy());
    expect(queryByLabelText('save it')).toBeNull();
  });

  it('shows the inert saved slot for a find_saved candidate (no live save button)', () => {
    const tr = toolResult([
      { place: place('Kamachiku', 'place_2'), source: 'saved', reason: null },
    ]);
    const { getByText, queryByLabelText } = renderCard([tr]);

    expect(getByText('saved')).toBeTruthy();
    expect(queryByLabelText('save it')).toBeNull();
  });

  it('disables the actions when the candidate has no catalog id', () => {
    const tr = toolResult([
      { place: place('Contact Tokyo', null), source: 'discovered', reason: null },
    ]);
    const { getByLabelText } = renderCard([tr]);

    expect(getByLabelText('good pick').props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.press(getByLabelText('good pick'));
    expect(mockedSendSignal).not.toHaveBeenCalled();
  });
});
