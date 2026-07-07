import { render } from '@testing-library/react-native';
import { CATEGORY_EMOJI, CATEGORY_EMOJI_FALLBACK } from '@kebi-app/shared';
import { PlaceAvatar } from './place-avatar';

describe('PlaceAvatar', () => {
  it('renders the emoji for the primary category', () => {
    const { getByText } = render(<PlaceAvatar categories={['cafe']} />);
    expect(getByText(CATEGORY_EMOJI.cafe)).toBeTruthy();
  });

  it('falls back to 📍 only when categories are empty', () => {
    const { getByText } = render(<PlaceAvatar categories={[]} />);
    expect(getByText(CATEGORY_EMOJI_FALLBACK)).toBeTruthy();
  });

  it('skips an unmapped category and uses the first that maps', () => {
    // 'point_of_interest' isn't in the map; 'beach' is — pin must not win.
    const { getByText, queryByText } = render(
      <PlaceAvatar categories={['point_of_interest' as never, 'beach']} />,
    );
    expect(getByText(CATEGORY_EMOJI.beach)).toBeTruthy();
    expect(queryByText(CATEGORY_EMOJI_FALLBACK)).toBeNull();
  });

  it('landmark renders a real glyph, not the 📍 fallback', () => {
    const { getByText } = render(<PlaceAvatar categories={['landmark']} />);
    expect(CATEGORY_EMOJI.landmark).not.toBe(CATEGORY_EMOJI_FALLBACK);
    expect(getByText(CATEGORY_EMOJI.landmark)).toBeTruthy();
  });

  it('honors an explicit emoji override', () => {
    const { getByText } = render(<PlaceAvatar categories={['cafe']} emoji="🍣" />);
    expect(getByText('🍣')).toBeTruthy();
  });

  it('prefers the LLM-picked icon over the category default', () => {
    const { getByText, queryByText } = render(<PlaceAvatar categories={['cafe']} icon="🗼" />);
    expect(getByText('🗼')).toBeTruthy();
    expect(queryByText(CATEGORY_EMOJI.cafe)).toBeNull();
  });

  it('falls back to the category mapping when icon is null', () => {
    const { getByText } = render(<PlaceAvatar categories={['cafe']} icon={null} />);
    expect(getByText(CATEGORY_EMOJI.cafe)).toBeTruthy();
  });
});
