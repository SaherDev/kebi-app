import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Group } from './group';

describe('Group', () => {
  it('renders the eyebrow and all rows', () => {
    const { getByText } = render(
      <Group eyebrow="saved places">
        <Text>Kamachiku</Text>
        <Text>Higashiya</Text>
      </Group>,
    );
    expect(getByText('saved places')).toBeTruthy();
    expect(getByText('Kamachiku')).toBeTruthy();
    expect(getByText('Higashiya')).toBeTruthy();
  });

  it('renders without an eyebrow', () => {
    const { getByText, queryByText } = render(
      <Group>
        <Text>only row</Text>
      </Group>,
    );
    expect(getByText('only row')).toBeTruthy();
    expect(queryByText('saved places')).toBeNull();
  });
});
