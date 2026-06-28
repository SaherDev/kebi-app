import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useHome } from './use-home';
import { getHome } from '../api/home';

// Avoid the real api client (createApiClient throws without EXPO_PUBLIC_API_URL)
// and the native location/weather lookups; the hook only needs their results.
jest.mock('../api/hooks', () => ({ useApiClient: () => ({}) }));
jest.mock('../lib/location', () => ({
  getDeviceLocation: async () => null,
  getDeviceCity: async () => null,
}));
jest.mock('../lib/weather', () => ({ getWeather: async () => null }));
jest.mock('../api/home', () => ({ getHome: jest.fn() }));

const mockedGetHome = getHome as jest.MockedFunction<typeof getHome>;

function Harness() {
  const { greeting, chips } = useHome();
  return (
    <>
      <Text testID="greeting">{greeting ?? 'null'}</Text>
      <Text testID="chips">{chips.map((c) => c.text).join('|')}</Text>
    </>
  );
}

describe('useHome', () => {
  beforeEach(() => mockedGetHome.mockReset());

  it('exposes the greeting and chips from the endpoint', async () => {
    mockedGetHome.mockResolvedValue({
      greeting: "it's late, drunk food?",
      chips: [{ text: 'ramen, no line' }, { text: 'surprise me' }],
    } as never);

    const { getByTestId } = render(<Harness />);

    await waitFor(() =>
      expect(getByTestId('greeting').props.children).toBe("it's late, drunk food?"),
    );
    expect(getByTestId('chips').props.children).toBe('ramen, no line|surprise me');
  });

  it('falls back to a null greeting + generic chips on a transport failure', async () => {
    mockedGetHome.mockRejectedValue(new Error('offline'));

    const { getByTestId } = render(<Harness />);

    await waitFor(() => expect(getByTestId('greeting').props.children).toBe('null'));
    // The three FALLBACK_CHIP_KEYS, resolved through i18n (en.json home.fallbackChips).
    expect(getByTestId('chips').props.children).toBe(
      'somewhere nearby|good for dinner|surprise me',
    );
  });
});
