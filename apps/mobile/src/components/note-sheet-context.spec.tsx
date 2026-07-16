import { render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { SavedPlaceView } from '@kebi-app/shared';
import { NoteSheetProvider, useNoteSheet } from './note-sheet-context';
import { PlaceActionsProvider } from './place-actions-context';
import { updateUserPlace } from '../api/library';

jest.mock('../api/library', () => ({
  updateUserPlace: jest.fn(),
  deleteUserPlace: jest.fn(),
}));
jest.mock('../lib/haptics', () => ({ triggerHaptic: jest.fn() }));

const mockChain = (): unknown => new Proxy({}, { get: () => () => mockChain() });
jest.mock('react-native-reanimated', () =>
  Object.assign(require('react-native-reanimated/mock'), {
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
  }),
);
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: (p: { children: unknown }) => p.children,
  GestureDetector: (p: { children: unknown }) => p.children,
  Gesture: { Pan: () => mockChain() },
}));

const mockUpdate = updateUserPlace as jest.Mock;

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
  user_data: {
    user_place_id: 'u1',
    place_id: 'p1',
    approved: true,
    visited: false,
    liked: null,
    note: 'old note',
    source: 'tiktok',
    source_ref: 'https://www.tiktok.com/@x/video/1',
    source_label: 'Saint Jardim',
    saved_at: '2026-05-01T08:00:00Z',
    visited_at: null,
  },
  claims: [],
};

function Opener() {
  const note = useNoteSheet();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="edit" onPress={() => note.open(view)}>
      <Text>edit</Text>
    </Pressable>
  );
}

function renderWithNote() {
  return render(
    <PlaceActionsProvider>
      <NoteSheetProvider>
        <Opener />
      </NoteSheetProvider>
    </PlaceActionsProvider>,
  );
}

describe('NoteSheet', () => {
  beforeEach(() => mockUpdate.mockReset());

  it('opens prefilled and saves the edited note via place actions', () => {
    mockUpdate.mockResolvedValue({ ...view.user_data, note: 'new note' });
    const { getByLabelText, getByDisplayValue } = renderWithNote();

    fireEvent.press(getByLabelText('edit'));
    const input = getByDisplayValue('old note'); // pre-filled with the current note
    fireEvent.changeText(input, 'new note');
    fireEvent.press(getByLabelText('save'));

    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), 'u1', { note: 'new note' });
  });

  it('clears the note to null when emptied', () => {
    mockUpdate.mockResolvedValue({ ...view.user_data, note: null });
    const { getByLabelText, getByDisplayValue } = renderWithNote();

    fireEvent.press(getByLabelText('edit'));
    fireEvent.changeText(getByDisplayValue('old note'), '');
    fireEvent.press(getByLabelText('save'));

    expect(mockUpdate).toHaveBeenCalledWith(expect.anything(), 'u1', { note: null });
  });
});
