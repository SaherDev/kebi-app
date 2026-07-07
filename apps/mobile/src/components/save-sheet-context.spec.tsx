import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { SaveSheetProvider, useSaveSheet } from './save-sheet-context';

// extractPlace is the unit under test's dependency — mock it per case. Keep the
// real EXTRACT_TIMEOUT_MS so the timeout wiring stays exercised.
const mockExtractPlace = jest.fn();
jest.mock('../api/extract', () => ({
  extractPlace: (...args: unknown[]) => mockExtractPlace(...args),
  EXTRACT_TIMEOUT_MS: 90_000,
}));

// The HTTP client is irrelevant once extractPlace is mocked (and this also keeps
// the Supabase-backed real client out of the test).
jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));

const mockShow = jest.fn();
jest.mock('./toast-context', () => ({ useToast: () => ({ show: mockShow, dismiss: jest.fn() }) }));

const mockAdd = jest.fn();
jest.mock('./saved-places-context', () => ({ useSavedPlaces: () => ({ items: [], add: mockAdd }) }));

// Capture the presentational sheet's props (it renders nothing) so the test can
// read open/status and invoke onSubmit — avoids the reanimated/gesture-handler
// (and react-native CSS-interop) the real sheet pulls into a mock factory.
const mockSheet: { props: Record<string, unknown> } = { props: {} };
jest.mock('./save-sheet', () => ({
  SaveSheet: (props: Record<string, unknown>) => {
    mockSheet.props = props;
    return null;
  },
}));

function Opener() {
  const { open } = useSaveSheet();
  return <Pressable accessibilityLabel="open" onPress={() => open()} />;
}

function PrefillOpener({ url }: { url: string }) {
  const { open } = useSaveSheet();
  return <Pressable accessibilityLabel="open-prefill" onPress={() => open(url)} />;
}

function renderProvider() {
  return render(
    <SaveSheetProvider>
      <Opener />
    </SaveSheetProvider>,
  );
}

const submit = async () => {
  await act(async () => {
    await (mockSheet.props.onSubmit as (t: string) => void)('coco tam');
  });
};

const place = (place_name: string) => ({ place_name });

beforeEach(() => {
  mockExtractPlace.mockReset();
  mockShow.mockReset();
  mockAdd.mockReset();
  mockSheet.props = {};
});

describe('SaveSheetProvider extract wiring', () => {
  it('completed → adds the place, shows a success toast, closes the sheet', async () => {
    mockExtractPlace.mockResolvedValue({
      status: 'completed',
      results: [{ place: place('Coco Tam'), confidence: 0.9 }],
      failure_reason: null,
    });
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    expect(mockSheet.props.open).toBe(true);

    await submit();

    expect(mockAdd).toHaveBeenCalledWith([place('Coco Tam')]);
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', text: 'saved Coco Tam' }),
    );
    expect(mockSheet.props.open).toBe(false);
  });

  it('open() → empty draft; open(url) → seeds initialValue for the iOS share flow', () => {
    const url = 'https://www.tiktok.com/@x/video/1';
    const { getByLabelText } = render(
      <SaveSheetProvider>
        <Opener />
        <PrefillOpener url={url} />
      </SaveSheetProvider>,
    );

    fireEvent.press(getByLabelText('open'));
    expect(mockSheet.props.open).toBe(true);
    expect(mockSheet.props.initialValue).toBe('');

    fireEvent.press(getByLabelText('open-prefill'));
    expect(mockSheet.props.initialValue).toBe(url);
  });

  it('many results → success toast names the count', async () => {
    mockExtractPlace.mockResolvedValue({
      status: 'completed',
      results: [place('A'), place('B'), place('C')].map((p) => ({ place: p, confidence: 0.5 })),
      failure_reason: null,
    });
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    await submit();

    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ text: 'saved 3 places' }));
  });

  it('unsupported_url → specific error toast, sheet stays open, status back to idle', async () => {
    mockExtractPlace.mockResolvedValue({
      status: 'failed',
      results: [],
      failure_reason: 'unsupported_url',
    });
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    await submit();

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', text: "that link isn't supported yet" }),
    );
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockSheet.props.open).toBe(true);
    await waitFor(() => expect(mockSheet.props.status).toBe('idle'));
  });

  it('thrown error (transport/schema/timeout) → generic error toast, stays open', async () => {
    mockExtractPlace.mockRejectedValue(new Error('boom'));
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    await submit();

    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'danger', text: "couldn't save that — try again" }),
    );
    expect(mockSheet.props.open).toBe(true);
  });
});
