import { fireEvent, render } from '@testing-library/react-native';
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

const claimList = (n: number, overrides: Partial<PlaceNote> = {}): PlaceNote[] =>
  Array.from({ length: n }, (_, i) =>
    makeClaim({ id: `clm_${i}`, text: `note ${i}`, ...overrides }),
  );

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

  it('says the share badge once in the header when every note is from the share', () => {
    const { getAllByText } = render(
      <PlaceClaimsSection claims={claimList(3, { from_shared: true })} />,
    );
    // One pill total — next to the header, not repeated per row.
    expect(getAllByText('from your share')).toHaveLength(1);
  });

  it('badges individual rows only when sources are mixed', () => {
    const claims = [
      makeClaim({ id: 'clm_s', from_shared: true }),
      makeClaim({ id: 'clm_c', text: 'plain community note' }),
    ];
    const { getAllByText } = render(<PlaceClaimsSection claims={claims} />);
    // Mixed → no header pill; exactly the one shared row carries it.
    expect(getAllByText('from your share')).toHaveLength(1);
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

  it('caps the list at 3 notes and expands/folds via the toggle', () => {
    const { getByText, queryByText } = render(<PlaceClaimsSection claims={claimList(5)} />);

    // Capped: strongest-first preview, the tail is folded.
    expect(getByText('note 0')).toBeTruthy();
    expect(getByText('note 2')).toBeTruthy();
    expect(queryByText('note 3')).toBeNull();
    expect(queryByText('note 4')).toBeNull();

    fireEvent.press(getByText('show all 5 notes'));
    expect(getByText('note 4')).toBeTruthy();

    fireEvent.press(getByText('show less'));
    expect(queryByText('note 4')).toBeNull();
    expect(getByText('show all 5 notes')).toBeTruthy();
  });

  it('shows no toggle when the list fits the preview', () => {
    const { queryByText } = render(<PlaceClaimsSection claims={claimList(3)} />);
    expect(queryByText('show all 3 notes')).toBeNull();
    expect(queryByText('show less')).toBeNull();
  });
});
