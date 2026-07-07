import { render } from '@testing-library/react-native';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  it('renders the label for each variant', () => {
    const { getByText } = render(
      <>
        <StatusPill variant="green">saved</StatusPill>
        <StatusPill variant="warm">new</StatusPill>
        <StatusPill variant="amber">approve?</StatusPill>
        <StatusPill variant="danger">closed</StatusPill>
      </>,
    );
    expect(getByText('saved')).toBeTruthy();
    expect(getByText('new')).toBeTruthy();
    expect(getByText('approve?')).toBeTruthy();
    expect(getByText('closed')).toBeTruthy();
  });
});
