import { Pressable } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { useUpgradeToast } from './use-upgrade-toast';

// jest.mock factories may only reference `mock`-prefixed outer variables.
const mockPush = jest.fn();
const mockShow = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('./toast-context', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('../i18n/context', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function Harness() {
  const showUpgrade = useUpgradeToast();
  return <Pressable accessibilityLabel="go" onPress={() => showUpgrade('limit hit')} />;
}

describe('useUpgradeToast', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockShow.mockClear();
  });

  it('shows a danger toast with a "see plans" action that opens /plans', () => {
    const { getByLabelText } = render(<Harness />);

    fireEvent.press(getByLabelText('go'));

    expect(mockShow).toHaveBeenCalledTimes(1);
    const opts = mockShow.mock.calls[0][0];
    expect(opts).toMatchObject({ tone: 'danger', text: 'limit hit' });
    expect(opts.action.label).toBe('plans.upgradeAction');

    // The action navigates to the plans screen.
    expect(mockPush).not.toHaveBeenCalled();
    opts.action.onPress();
    expect(mockPush).toHaveBeenCalledWith('/plans');
  });
});
