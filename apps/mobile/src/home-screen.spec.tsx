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
}));

describe('HomeScreen — A3 navigation shell', () => {
  it('renders the home title and the floating AI button', () => {
    const { getByText, getByLabelText } = render(<HomeScreen />);
    expect(getByText('home')).toBeTruthy();
    expect(getByLabelText('ask kebi')).toBeTruthy();
  });
});
