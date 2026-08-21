import { render } from '@testing-library/react-native';
import { FieldsSkeleton } from './fields-skeleton';

describe('FieldsSkeleton', () => {
  it('keeps the field labels — they are static text, not data', () => {
    const { getByText } = render(<FieldsSkeleton labels={['call me', 'home country', 'the gist']} />);
    expect(getByText('call me')).toBeTruthy();
    expect(getByText('home country')).toBeTruthy();
    expect(getByText('the gist')).toBeTruthy();
  });

  it('renders no input and no save affordance in either state', () => {
    // The invariant behind the forms' failed read: a block we could not load
    // must not be editable, because saving writes it whole.
    const { queryByLabelText, UNSAFE_queryAllByType } = render(
      <FieldsSkeleton labels={['call me']} frozen />,
    );
    expect(queryByLabelText('save')).toBeNull();
    expect(UNSAFE_queryAllByType('TextInput' as never)).toHaveLength(0);
  });
});
