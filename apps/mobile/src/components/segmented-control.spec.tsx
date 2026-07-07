import { render, fireEvent } from '@testing-library/react-native';
import { SegmentedControl, type SegmentOption } from './segmented-control';

const OPTIONS: SegmentOption<'light' | 'dark' | 'system'>[] = [
  { value: 'light', label: 'light' },
  { value: 'dark', label: 'dark' },
  { value: 'system', label: 'system' },
];

describe('SegmentedControl', () => {
  it('renders every option label', () => {
    const { getByText } = render(
      <SegmentedControl options={OPTIONS} value="system" onChange={jest.fn()} />,
    );
    expect(getByText('light')).toBeTruthy();
    expect(getByText('dark')).toBeTruthy();
    expect(getByText('system')).toBeTruthy();
  });

  it('marks the active option as selected', () => {
    const { getByLabelText } = render(
      <SegmentedControl options={OPTIONS} value="dark" onChange={jest.fn()} />,
    );
    expect(getByLabelText('dark').props.accessibilityState).toMatchObject({ selected: true });
    expect(getByLabelText('light').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('fires onChange with the tapped value', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <SegmentedControl options={OPTIONS} value="system" onChange={onChange} />,
    );
    fireEvent.press(getByText('light'));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
