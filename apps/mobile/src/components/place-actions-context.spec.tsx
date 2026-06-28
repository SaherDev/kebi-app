import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { SavedPlaceView, UserPlace } from '@kebi-app/shared';
import { PlaceActionsProvider, usePlaceActions } from './place-actions-context';
import { deleteUserPlace, updateUserPlace } from '../api/library';

jest.mock('../api/library', () => ({
  updateUserPlace: jest.fn(),
  deleteUserPlace: jest.fn(),
}));
jest.mock('../lib/haptics', () => ({ triggerHaptic: jest.fn() }));

const mockUpdate = updateUserPlace as jest.Mock;
const mockDelete = deleteUserPlace as jest.Mock;

const userData: UserPlace = {
  user_place_id: 'u1',
  place_id: 'p1',
  approved: true,
  visited: false,
  liked: null,
  note: null,
  source: 'tiktok',
  source_ref: 'https://www.tiktok.com/@x/video/1',
  source_label: 'Saint Jardim',
  saved_at: '2026-05-01T08:00:00Z',
  visited_at: null,
};

const view: SavedPlaceView = {
  place: {
    id: 'p1',
    provider_id: null,
    place_name: 'Saint Jardim',
    place_name_aliases: [],
    categories: ['restaurant'],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
  },
  user_data: userData,
};

function Harness() {
  const { update, forget, resolve } = usePlaceActions();
  const r = resolve(view);
  return (
    <>
      <Text>{`liked:${String(r.userData.liked)} removed:${String(r.removed)}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="like" onPress={() => update(view, { liked: true })}>
        <Text>like</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="forget" onPress={() => forget(view)}>
        <Text>forget</Text>
      </Pressable>
    </>
  );
}

function renderHarness() {
  return render(
    <PlaceActionsProvider>
      <Harness />
    </PlaceActionsProvider>,
  );
}

describe('PlaceActions', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  it('update PATCHes and reflects the new state via resolve', async () => {
    mockUpdate.mockResolvedValue({ ...userData, liked: true });
    const { getByLabelText, getByText } = renderHarness();

    fireEvent.press(getByLabelText('like'));

    // optimistic + committed: resolve reports liked:true
    await waitFor(() => expect(getByText(/liked:true/)).toBeTruthy());
    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), 'u1', { liked: true });
  });

  it('forget marks removed and DELETEs after the undo window', async () => {
    jest.useFakeTimers();
    mockDelete.mockResolvedValue(undefined);
    const { getByLabelText, getByText } = renderHarness();

    act(() => {
      fireEvent.press(getByLabelText('forget'));
    });
    expect(getByText(/removed:true/)).toBeTruthy(); // optimistic removal

    await act(async () => {
      jest.advanceTimersByTime(10000); // past the undo window → commit the DELETE
    });
    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), 'u1');
    jest.useRealTimers();
  });
});
