import { render } from '@testing-library/react-native';
import HomeScreen from './app/index';

// expo-router pulls in the native navigation runtime; mock the surface the
// screen graph uses (useRouter) instead of mounting the real router/_layout.
// babel-jest hoists this jest.mock above the imports above, so HomeScreen
// resolves against the mock.
// NOTE: this test lives in src/ (not src/app/) — expo-router's require.context
// over the routes dir would otherwise bundle it (and @testing-library) into the
// app and fail to resolve Node's `console`/`util` at runtime.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useFocusEffect: () => undefined,
}));

// The three home data hooks each have their own spec; stub them here so the
// screen renders without the api client / native location lookups.
jest.mock('./components/use-home', () => ({
  useHome: () => ({ greeting: null, chips: [], city: null, weather: null, loading: false }),
}));
jest.mock('./components/use-intents', () => ({
  useIntents: () => ({ intents: [], loading: false, error: false }),
}));
jest.mock('./components/use-stash', () => ({
  useStash: () => ({ views: [], total: 0, loading: false, error: false }),
}));

describe('HomeScreen — A3 navigation shell', () => {
  it('renders the kebi greeting eyebrow and the floating AI button', () => {
    const { getByText, getByLabelText } = render(<HomeScreen />);
    expect(getByText('kebi')).toBeTruthy();
    expect(getByLabelText('ask kebi')).toBeTruthy();
  });
});
