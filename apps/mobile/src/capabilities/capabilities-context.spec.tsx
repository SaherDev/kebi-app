import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { NO_CAPABILITIES } from './capability';
import type { CapabilityState } from './capability-source';
import { Can, CapabilitiesProvider, useCan } from './capabilities-context';

/** A source stub — the seam in action: the gate cannot tell this from the real one. */
const sourceOf = (state: Partial<CapabilityState>) => () => ({
  capabilities: NO_CAPABILITIES,
  resolved: false,
  revalidate: () => undefined,
  ...state,
});

function Probe() {
  return <Text>{useCan('curate') ? 'allowed' : 'denied'}</Text>;
}

describe('capability gate', () => {
  it('allows only when resolved and granted', () => {
    render(
      <CapabilitiesProvider source={sourceOf({ capabilities: { curate: true }, resolved: true })}>
        <Probe />
      </CapabilitiesProvider>,
    );
    expect(screen.getByText('allowed')).toBeTruthy();
  });

  it('denies when resolved and not granted', () => {
    render(
      <CapabilitiesProvider source={sourceOf({ capabilities: { curate: false }, resolved: true })}>
        <Probe />
      </CapabilitiesProvider>,
    );
    expect(screen.getByText('denied')).toBeTruthy();
  });

  it('denies while unresolved even if the pending value says otherwise', () => {
    // The flash-then-hide bug this layer exists to prevent: never render an
    // affordance on an answer that has not landed.
    render(
      <CapabilitiesProvider source={sourceOf({ capabilities: { curate: true }, resolved: false })}>
        <Probe />
      </CapabilitiesProvider>,
    );
    expect(screen.getByText('denied')).toBeTruthy();
  });

  it('denies when mounted with no provider at all', () => {
    // A consumer rendered outside the tree must fail closed, not crash open.
    render(<Probe />);
    expect(screen.getByText('denied')).toBeTruthy();
  });

  describe('<Can>', () => {
    it('renders children when granted', () => {
      render(
        <CapabilitiesProvider source={sourceOf({ capabilities: { curate: true }, resolved: true })}>
          <Can do="curate">
            <Text>insider row</Text>
          </Can>
        </CapabilitiesProvider>,
      );
      expect(screen.getByText('insider row')).toBeTruthy();
    });

    it('renders nothing by default when denied', () => {
      render(
        <CapabilitiesProvider source={sourceOf({ capabilities: { curate: false }, resolved: true })}>
          <Can do="curate">
            <Text>insider row</Text>
          </Can>
        </CapabilitiesProvider>,
      );
      expect(screen.queryByText('insider row')).toBeNull();
    });

    it('renders the fallback when one is given', () => {
      render(
        <CapabilitiesProvider source={sourceOf({ capabilities: { curate: false }, resolved: true })}>
          <Can do="curate" fallback={<Text>nothing here</Text>}>
            <Text>insider row</Text>
          </Can>
        </CapabilitiesProvider>,
      );
      expect(screen.getByText('nothing here')).toBeTruthy();
      expect(screen.queryByText('insider row')).toBeNull();
    });
  });

  it('flipping the grant off removes the affordance on re-render', () => {
    // "One boolean stops everything": the same tree, one value changed.
    const { rerender } = render(
      <CapabilitiesProvider source={sourceOf({ capabilities: { curate: true }, resolved: true })}>
        <Can do="curate">
          <Text>insider row</Text>
        </Can>
      </CapabilitiesProvider>,
    );
    expect(screen.getByText('insider row')).toBeTruthy();

    rerender(
      <CapabilitiesProvider source={sourceOf({ capabilities: { curate: false }, resolved: true })}>
        <Can do="curate">
          <Text>insider row</Text>
        </Can>
      </CapabilitiesProvider>,
    );
    expect(screen.queryByText('insider row')).toBeNull();
  });
});
