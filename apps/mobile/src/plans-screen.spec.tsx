import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlansScreen from './app/plans';

// Mock the route graph surface + the screen's data/edge dependencies. Lives in
// src/ (not src/app/) so expo-router's require.context doesn't bundle the test.
// jest.mock factories may only reference `mock`-prefixed outer variables.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

const mockSetLocalPlan = jest.fn();
jest.mock('./components/use-profile', () => ({
  useProfile: () => ({
    profile: { name: 'saher', email: 'saher@kebi.app', plan: 'homebody' },
    loading: false,
    error: false,
    refetch: jest.fn(),
    setLocalName: jest.fn(),
    setLocalPlan: mockSetLocalPlan,
  }),
}));

const mockChangePlan = jest.fn().mockResolvedValue({ name: 'saher', email: '', plan: 'explorer' });
jest.mock('./api/plan', () => ({ changePlan: (...args: unknown[]) => mockChangePlan(...args) }));

jest.mock('./api/hooks', () => ({ useApiClient: () => ({}) }));

const mockRefreshSession = jest.fn().mockResolvedValue(undefined);
// Lazy forwarder: the auth object is built at factory-run (import) time, so it
// must reference the spy at call time, not capture it before it's initialized.
jest.mock('./lib/supabase', () => ({
  supabase: { auth: { refreshSession: (...args: unknown[]) => mockRefreshSession(...args) } },
}));

describe('PlansScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSetLocalPlan.mockClear();
    mockChangePlan.mockClear();
    mockRefreshSession.mockClear();
  });

  it('renders the hero and all three tiers', () => {
    const { getByText } = render(<PlansScreen />);
    expect(getByText('pick your vibe')).toBeTruthy();
    expect(getByText('homebody')).toBeTruthy();
    expect(getByText('explorer')).toBeTruthy();
    expect(getByText('local legend')).toBeTruthy();
  });

  it('marks the current tier with a disabled "your current plan" CTA', () => {
    const { getByLabelText } = render(<PlansScreen />);
    // homebody is current → its CTA is the disabled current-plan button.
    expect(getByLabelText('your current plan').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('switches plan optimistically, calls the gateway, and refreshes the token', async () => {
    const { getByLabelText } = render(<PlansScreen />);

    fireEvent.press(getByLabelText('upgrade to explorer'));

    expect(mockSetLocalPlan).toHaveBeenCalledWith('explorer'); // optimistic, synchronous
    await waitFor(() => expect(mockChangePlan).toHaveBeenCalledWith({}, 'explorer'));
    await waitFor(() => expect(mockRefreshSession).toHaveBeenCalled());
  });

  it('rolls the plan back when the switch fails', async () => {
    mockChangePlan.mockRejectedValueOnce(new Error('boom'));
    const { getByLabelText } = render(<PlansScreen />);

    fireEvent.press(getByLabelText('go legend'));

    expect(mockSetLocalPlan).toHaveBeenCalledWith('local_legend'); // optimistic
    await waitFor(() => expect(mockSetLocalPlan).toHaveBeenLastCalledWith('homebody')); // rollback
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});
