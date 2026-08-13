import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { SaveSheetProvider, useSaveSheet } from './save-sheet-context';

// extractPlace is the unit under test's dependency — mock it per case. Keep the
// real EXTRACT_TIMEOUT_MS / EXTRACT_GRACE_MS so the timer wiring stays exercised.
const mockExtractPlace = jest.fn();
jest.mock('../api/extract', () => ({
  extractPlace: (...args: unknown[]) => mockExtractPlace(...args),
  EXTRACT_TIMEOUT_MS: 90_000,
  EXTRACT_GRACE_MS: 5_000,
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
    // Sheet is still up, so the toast needs no retry action (the draft is right there).
    expect(mockShow.mock.calls[0][0].action).toBeUndefined();
  });
});

describe('SaveSheetProvider background flow', () => {
  // Deferred extract: the promise resolves/rejects only when the test says so,
  // letting the grace timer fire first.
  const deferExtract = () => {
    let resolve!: (v: unknown) => void;
    let reject!: (e: Error) => void;
    mockExtractPlace.mockImplementation(
      () =>
        new Promise((res, rej) => {
          resolve = res;
          reject = rej;
        }),
    );
    return { resolve: (v: unknown) => resolve(v), reject: (e: Error) => reject(e) };
  };

  const url = 'https://www.tiktok.com/@x/video/1';

  // Submit without awaiting: the extract is still pending when this returns.
  const submitPending = () => {
    act(() => {
      void (mockSheet.props.onSubmit as (t: string) => void)(url);
    });
  };

  const closeSheet = () => {
    act(() => {
      (mockSheet.props.onClose as () => void)();
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('grace elapsed → status flips to backgrounded, sheet still open', () => {
    deferExtract();
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    submitPending();
    expect(mockSheet.props.status).toBe('saving');

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(mockSheet.props.status).toBe('backgrounded');
    expect(mockSheet.props.open).toBe(true);
  });

  it('result lands while backgrounded sheet is still open → resolves in place', async () => {
    const d = deferExtract();
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    submitPending();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    await act(async () => {
      d.resolve({
        status: 'completed',
        results: [{ place: place('Somtum Der'), confidence: 0.9 }],
        failure_reason: null,
      });
    });

    expect(mockAdd).toHaveBeenCalledWith([place('Somtum Der')]);
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' }));
    expect(mockSheet.props.open).toBe(false);
    expect(mockSheet.props.status).toBe('idle');
  });

  it('dismissed while backgrounded → late success is toast-only, sheet stays closed', async () => {
    const d = deferExtract();
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    submitPending();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    closeSheet();
    expect(mockSheet.props.open).toBe(false);

    await act(async () => {
      d.resolve({
        status: 'completed',
        results: [{ place: place('Somtum Der'), confidence: 0.9 }],
        failure_reason: null,
      });
    });

    expect(mockAdd).toHaveBeenCalledWith([place('Somtum Der')]);
    expect(mockShow).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'success', text: 'saved Somtum Der' }),
    );
    expect(mockSheet.props.open).toBe(false);
  });

  it('dismissed while backgrounded → late failure toast carries "try again" that reopens prefilled', async () => {
    const d = deferExtract();
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    submitPending();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    closeSheet();

    await act(async () => {
      d.reject(new Error('boom'));
    });

    const toastArgs = mockShow.mock.calls[0][0];
    expect(toastArgs).toMatchObject({ tone: 'danger', text: "couldn't save that — try again" });
    expect(toastArgs.action).toMatchObject({ label: 'try again' });

    act(() => {
      toastArgs.action.onPress();
    });
    expect(mockSheet.props.open).toBe(true);
    expect(mockSheet.props.initialValue).toBe(url);
  });

  it('dismissed backgrounded save keeps running while a second save proceeds', async () => {
    const first = deferExtract();
    const { getByLabelText } = renderProvider();
    fireEvent.press(getByLabelText('open'));
    submitPending();
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    closeSheet();

    // Second save: fresh submit resolves fast and owns the sheet.
    mockExtractPlace.mockResolvedValue({
      status: 'completed',
      results: [{ place: place('Fuglen'), confidence: 0.9 }],
      failure_reason: null,
    });
    fireEvent.press(getByLabelText('open'));
    await act(async () => {
      await (mockSheet.props.onSubmit as (t: string) => void)('fuglen');
    });
    expect(mockAdd).toHaveBeenCalledWith([place('Fuglen')]);
    expect(mockSheet.props.open).toBe(false);

    // First save lands later — toast only, no sheet-state interference.
    await act(async () => {
      first.resolve({
        status: 'completed',
        results: [{ place: place('Somtum Der'), confidence: 0.9 }],
        failure_reason: null,
      });
    });
    expect(mockAdd).toHaveBeenCalledWith([place('Somtum Der')]);
    expect(mockSheet.props.open).toBe(false);
    expect(mockSheet.props.status).toBe('idle');
  });
});
