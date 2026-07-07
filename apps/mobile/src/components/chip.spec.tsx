import { render } from '@testing-library/react-native';
import { Chip } from './chip';

describe('Chip', () => {
  it('renders an atmosphere chip with emoji and label', () => {
    const { getByText } = render(
      <Chip variant="atmosphere" emoji="🕯️">
        intimate
      </Chip>,
    );
    expect(getByText('🕯️')).toBeTruthy();
    expect(getByText('intimate')).toBeTruthy();
  });

  it('renders a feature chip label', () => {
    const { getByText } = render(<Chip variant="feature">dog friendly</Chip>);
    expect(getByText('dog friendly')).toBeTruthy();
  });
});
