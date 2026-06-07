import { render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { PlaceCore } from '@kebi-app/shared';
import { SavedPlacesProvider, useSavedPlaces } from './saved-places-context';

function place(name: string, id: string | null = null): PlaceCore {
  return {
    id,
    provider_id: null,
    place_name: name,
    place_name_aliases: [],
    categories: [],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
  };
}

// Probe: lists current items (key:name) and adds a batch on press.
function Probe({ batch }: { batch: PlaceCore[] }) {
  const { items, add } = useSavedPlaces();
  return (
    <>
      <Pressable accessibilityLabel="add" onPress={() => add(batch)} />
      {items.map((i) => (
        <Text key={i.key}>{`${i.key}:${i.place.place_name}`}</Text>
      ))}
    </>
  );
}

describe('SavedPlacesProvider', () => {
  it('keeps distinct places, newest on top, with unique keys', () => {
    const { getByLabelText, getAllByText, queryByText } = render(
      <SavedPlacesProvider>
        <Probe batch={[place('Fuglen')]} />
      </SavedPlacesProvider>,
    );

    expect(queryByText(/Fuglen/)).toBeNull();
    fireEvent.press(getByLabelText('add'));

    const rows = getAllByText(/Fuglen/).map((n) => n.props.children as string);
    expect(rows).toHaveLength(1);
  });

  it('dedupes a place re-saved with the same id (ADR-074) → one row', () => {
    const { getByLabelText, getAllByText } = render(
      <SavedPlacesProvider>
        <Probe batch={[place('Coco Tam', 'place-1')]} />
      </SavedPlacesProvider>,
    );
    fireEvent.press(getByLabelText('add'));
    fireEvent.press(getByLabelText('add'));
    expect(getAllByText(/Coco Tam/)).toHaveLength(1);
  });

  it('dedupes a no-id place by name, and within a single batch', () => {
    const { getByLabelText, getAllByText } = render(
      <SavedPlacesProvider>
        <Probe batch={[place('Bar Trench'), place('Bar Trench')]} />
      </SavedPlacesProvider>,
    );
    fireEvent.press(getByLabelText('add'));
    fireEvent.press(getByLabelText('add'));
    expect(getAllByText(/Bar Trench/)).toHaveLength(1);
  });

  it('adds a multi-place batch in order, newest batch on top', () => {
    const { getByLabelText, getAllByText } = render(
      <SavedPlacesProvider>
        <Probe batch={[place('A'), place('B')]} />
      </SavedPlacesProvider>,
    );

    fireEvent.press(getByLabelText('add'));
    const names = getAllByText(/:/).map((n) => (n.props.children as string).split(':')[1]);
    expect(names).toEqual(['A', 'B']);
  });
});
