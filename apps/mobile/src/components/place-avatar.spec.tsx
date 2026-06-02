import { render } from '@testing-library/react-native';
import { CATEGORY_EMOJI, CATEGORY_EMOJI_FALLBACK } from '@kebi-app/shared';
import { PlaceAvatar } from './place-avatar';

describe('PlaceAvatar', () => {
  it('renders the emoji for the primary category', () => {
    const { getByText } = render(<PlaceAvatar categories={['cafe']} />);
    expect(getByText(CATEGORY_EMOJI.cafe)).toBeTruthy();
  });

  it('falls back to 📍 when categories are empty', () => {
    const { getByText } = render(<PlaceAvatar categories={[]} />);
    expect(getByText(CATEGORY_EMOJI_FALLBACK)).toBeTruthy();
  });

  it('honors an explicit emoji override', () => {
    const { getByText } = render(<PlaceAvatar categories={['cafe']} emoji="🍣" />);
    expect(getByText('🍣')).toBeTruthy();
  });
});
