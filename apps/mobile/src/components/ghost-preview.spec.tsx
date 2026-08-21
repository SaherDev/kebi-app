import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AddRow, GhostPreview } from './ghost-preview';

describe('GhostPreview', () => {
  it('renders the shape it is standing in for, hidden from screen readers', () => {
    // The ghost is a picture of content that does not exist — sighted users see
    // the shape, assistive tech must not be told about places nobody saved.
    const { getByText, queryByText } = render(
      <GhostPreview>
        <Text>the ramen place you sent yourself</Text>
      </GhostPreview>,
    );
    expect(getByText('the ramen place you sent yourself', { includeHiddenElements: true })).toBeTruthy();
    expect(queryByText('the ramen place you sent yourself')).toBeNull();
  });
});

describe('AddRow', () => {
  it('is the action, not decoration', () => {
    const onPress = jest.fn();
    const { getByLabelText, getByText } = render(
      <AddRow label="save your first place" sublabel="paste a link" onPress={onPress} />,
    );
    expect(getByText('paste a link')).toBeTruthy();
    fireEvent.press(getByLabelText('save your first place'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
