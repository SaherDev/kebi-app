import { fireEvent, render } from '@testing-library/react-native';
import { ErrorRow } from './error-row';

describe('ErrorRow', () => {
  it('renders the sentence and its detail', () => {
    const { getByText } = render(
      <ErrorRow text="couldn't load your places." detail="nothing lost." />,
    );
    expect(getByText(/couldn't load your places\./)).toBeTruthy();
    expect(getByText(/nothing lost\./)).toBeTruthy();
  });

  it('runs the action when one is offered', () => {
    const onAction = jest.fn();
    const { getByLabelText } = render(
      <ErrorRow text="couldn't load" actionLabel="retry" onAction={onAction} />,
    );
    fireEvent.press(getByLabelText('retry'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('offers no action when there is nothing to retry', () => {
    // A 404 or a plan limit: retrying can never change the outcome, so the row
    // is a statement rather than a button.
    const { queryByLabelText } = render(<ErrorRow text="that area isn't there" tone="warn" />);
    expect(queryByLabelText('retry')).toBeNull();
  });

  it('needs both the label and the handler before it draws an action', () => {
    const { queryByLabelText } = render(<ErrorRow text="couldn't load" actionLabel="retry" />);
    expect(queryByLabelText('retry')).toBeNull();
  });
});
