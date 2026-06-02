import { render } from '@testing-library/react-native';
import { ATMOSPHERE_EMOJI } from '@kebi-app/shared';
import { PlaceChip } from './place-chip';

describe('PlaceChip', () => {
  it('renders an atmosphere tag with its vibe emoji and label', () => {
    const { getByText } = render(
      <PlaceChip tag={{ type: 'atmosphere', value: 'intimate', source: 'llm' }} />,
    );
    expect(getByText(ATMOSPHERE_EMOJI.intimate)).toBeTruthy();
    expect(getByText('intimate')).toBeTruthy();
  });

  it('renders a feature tag, formatting snake_case into spaced words', () => {
    const { getByText } = render(
      <PlaceChip tag={{ type: 'feature', value: 'dog_friendly', source: 'google' }} />,
    );
    expect(getByText('dog friendly')).toBeTruthy();
  });

  it('maps a non-atmosphere tag (cuisine) to a feature chip, keeping its case', () => {
    const { getByText } = render(
      <PlaceChip tag={{ type: 'cuisine', value: 'Japanese', source: 'llm' }} />,
    );
    expect(getByText('Japanese')).toBeTruthy();
  });
});
