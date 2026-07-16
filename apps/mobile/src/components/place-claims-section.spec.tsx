import { render } from '@testing-library/react-native';
import type { PlaceNote } from '@kebi-app/shared';
import { PlaceClaimsSection } from './place-claims-section';

function makeClaim(overrides: Partial<PlaceNote> = {}): PlaceNote {
  return {
    id: 'clm_1',
    text: 'book the counter, not the tables',
    tags: [],
    source: 'community',
    from_shared: false,
    agree_count: 0,
    disagree_count: 0,
    ...overrides,
  };
}

describe('PlaceClaimsSection', () => {
  it('renders nothing when the place has no claims', () => {
    const { toJSON } = render(<PlaceClaimsSection claims={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders the section header and each claim text', () => {
    const claims = [
      makeClaim(),
      makeClaim({ id: 'clm_2', text: 'corkage waived on mondays' }),
    ];
    const { getByText } = render(<PlaceClaimsSection claims={claims} />);
    expect(getByText('insider notes')).toBeTruthy();
    expect(getByText('book the counter, not the tables')).toBeTruthy();
    expect(getByText('corkage waived on mondays')).toBeTruthy();
  });

  it('badges a claim mined from the shared post with the warm pill', () => {
    const { getByText } = render(
      <PlaceClaimsSection claims={[makeClaim({ from_shared: true })]} />,
    );
    expect(getByText('from what you shared')).toBeTruthy();
  });

  it('labels expert and kebi origins; community stays unlabelled', () => {
    const claims = [
      makeClaim({ id: 'clm_e', source: 'expert' }),
      makeClaim({ id: 'clm_k', source: 'kebi' }),
      makeClaim({ id: 'clm_c', source: 'community' }),
    ];
    const { getByText, queryByText } = render(<PlaceClaimsSection claims={claims} />);
    expect(getByText('expert')).toBeTruthy();
    expect(getByText('your save reason')).toBeTruthy();
    expect(queryByText('community')).toBeNull();
  });

  it('shows the agree tally only when it is above zero', () => {
    const claims = [
      makeClaim({ id: 'clm_a', agree_count: 8 }),
      makeClaim({ id: 'clm_z', agree_count: 0 }),
    ];
    const { getByText, queryByText } = render(<PlaceClaimsSection claims={claims} />);
    expect(getByText('8 agree')).toBeTruthy();
    expect(queryByText('0 agree')).toBeNull();
  });
});
