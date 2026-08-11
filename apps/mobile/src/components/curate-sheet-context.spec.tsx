import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CurateSheetProvider, useCurateSheet, type CurateTarget } from './curate-sheet-context';

const mockShow = jest.fn();
jest.mock('./toast-context', () => ({
  useToast: () => ({ show: mockShow, dismiss: jest.fn(), reserveTopAnchor: () => () => undefined }),
}));

jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));

const mockCurate = jest.fn();
jest.mock('../api/knowledge', () => ({
  curate: (...args: unknown[]) => mockCurate(...args),
}));

// The sheet itself is exercised separately; here we only need its inputs and a
// way to drive submit/dismiss. Capturing props (never requiring react-native
// inside the factory) is the house pattern for mocking a mobile component.
let sheetProps: Record<string, unknown> = {};
jest.mock('./curate-sheet', () => ({
  CurateSheet: (props: Record<string, unknown>) => {
    sheetProps = props;
    return null;
  },
}));

const PLACE: CurateTarget = {
  anchor: { place_id: 'place_1' },
  view: { emoji: '🍜', name: 'Kamachiku', context: 'nezu' },
};
const AREA: CurateTarget = {
  anchor: { area_id: 'area_token' },
  view: { emoji: '🗺️', name: 'Shimokitazawa' },
};

function Opener({ target = PLACE }: { target?: CurateTarget }) {
  const { open } = useCurateSheet();
  return (
    <Pressable accessibilityRole="button" onPress={() => open(target)}>
      <Text>open</Text>
    </Pressable>
  );
}

const renderWith = (target?: CurateTarget) =>
  render(
    <CurateSheetProvider>
      <Opener target={target} />
    </CurateSheetProvider>,
  );

const type = (text: string) => act(() => (sheetProps.onChangeText as (t: string) => void)(text));
const submit = (text: string) => act(() => (sheetProps.onSubmit as (t: string) => void)(text));
const dismiss = () => act(() => (sheetProps.onClose as () => void)());

describe('CurateSheetProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sheetProps = {};
    mockCurate.mockResolvedValue({ claims_written: 2, claims: [], storedNothing: false });
  });

  it('opens closed, and a door raises it with its anchor', () => {
    renderWith();
    expect(sheetProps.open).toBe(false);

    fireEvent.press(screen.getByText('open'));

    expect(sheetProps.open).toBe(true);
    expect(sheetProps.anchor).toEqual({ emoji: '🍜', name: 'Kamachiku', context: 'nezu' });
  });

  it('sends the prose with the anchor', async () => {
    renderWith();
    fireEvent.press(screen.getByText('open'));
    submit('go at 11:30');

    await waitFor(() => expect(mockCurate).toHaveBeenCalled());
    expect(mockCurate).toHaveBeenCalledWith({}, 'go at 11:30', { place_id: 'place_1' });
  });

  it('closes immediately on submit rather than waiting for the request', () => {
    renderWith();
    fireEvent.press(screen.getByText('open'));
    submit('go at 11:30');

    // Optimistic: the sheet is gone before the promise settles.
    expect(sheetProps.open).toBe(false);
  });

  it('toasts the count that came back', async () => {
    renderWith();
    fireEvent.press(screen.getByText('open'));
    submit('prose');

    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    expect(mockShow.mock.calls[0][0].text).toContain('2');
  });

  it('says nothing new when kebi stored nothing (a dupe is not "added")', async () => {
    mockCurate.mockResolvedValueOnce({ claims_written: 0, claims: [], storedNothing: true });
    renderWith();
    fireEvent.press(screen.getByText('open'));
    submit('prose');

    await waitFor(() => expect(mockShow).toHaveBeenCalled());
    expect(mockShow.mock.calls[0][0].text).toBe('kebi already knew that');
  });

  describe('drafts', () => {
    it('keeps the text when dismissed, and restores it on reopen', () => {
      renderWith();
      fireEvent.press(screen.getByText('open'));
      type('half a sentence');
      dismiss();

      fireEvent.press(screen.getByText('open'));
      expect(sheetProps.value).toBe('half a sentence');
    });

    it('keeps drafts separate per anchor', () => {
      const { rerender } = render(
        <CurateSheetProvider>
          <Opener target={PLACE} />
        </CurateSheetProvider>,
      );
      fireEvent.press(screen.getByText('open'));
      type('about the place');
      dismiss();

      rerender(
        <CurateSheetProvider>
          <Opener target={AREA} />
        </CurateSheetProvider>,
      );
      fireEvent.press(screen.getByText('open'));

      // The area's draft is its own — the place's text must not bleed across.
      expect(sheetProps.value).toBe('');
    });

    it('clears the draft after a successful send', async () => {
      renderWith();
      fireEvent.press(screen.getByText('open'));
      type('prose');
      submit('prose');
      await waitFor(() => expect(mockShow).toHaveBeenCalled());

      fireEvent.press(screen.getByText('open'));
      expect(sheetProps.value).toBe('');
    });

    it('keeps the draft when the send fails, so nothing written is lost', async () => {
      mockCurate.mockRejectedValueOnce(new Error('offline'));
      renderWith();
      fireEvent.press(screen.getByText('open'));
      type('hard-won prose');
      submit('hard-won prose');

      await waitFor(() => expect(mockShow).toHaveBeenCalled());
      expect(mockShow.mock.calls[0][0].text).toContain("couldn't send");

      fireEvent.press(screen.getByText('open'));
      expect(sheetProps.value).toBe('hard-won prose');
    });
  });

  it('sends without an anchor when the door supplies none', async () => {
    renderWith({ anchor: undefined, view: null });
    fireEvent.press(screen.getByText('open'));
    submit('unanchored prose');

    await waitFor(() => expect(mockCurate).toHaveBeenCalled());
    expect(mockCurate).toHaveBeenCalledWith({}, 'unanchored prose', undefined);
  });
});
