import { render, fireEvent } from '@testing-library/react-native';
import type { SseToolResult } from '@kebi-app/shared';
import { ChatPlaceCard } from './chat-place-card';

function place(name: string) {
  return {
    id: null,
    provider_id: null,
    place_name: name,
    place_name_aliases: [],
    categories: ['restaurant'],
    tags: [],
    location: null,
    created_at: null,
    refreshed_at: null,
  };
}

function toolResult(candidates: unknown[]): SseToolResult {
  return { tool: 'discover_places', tool_call_id: 'c1', payload: { candidates } } as SseToolResult;
}

describe('ChatPlaceCard', () => {
  it('renders the primary pick, its reason, the actions, and a swap row', () => {
    const tr = toolResult([
      { place: place('Contact Tokyo'), source: 'discovered', reason: 'great deep house' },
      { place: place('Bar Trench'), source: 'discovered', reason: null },
    ]);

    const { getByText } = render(<ChatPlaceCard toolResults={[tr]} />);

    expect(getByText('Contact Tokyo')).toBeTruthy();
    expect(getByText('great deep house')).toBeTruthy();
    expect(getByText('good pick')).toBeTruthy(); // inert action
    expect(getByText('Bar Trench')).toBeTruthy(); // swap
  });

  it('promotes a swap to the recommendation when tapped', () => {
    const tr = toolResult([
      { place: place('Contact Tokyo'), source: 'discovered', reason: 'deep house' },
      { place: place('Bar Trench'), source: 'discovered', reason: 'cocktails' },
    ]);

    const { getByText, queryByText, getByLabelText } = render(<ChatPlaceCard toolResults={[tr]} />);

    expect(getByText('deep house')).toBeTruthy(); // primary's reason
    expect(queryByText('cocktails')).toBeNull(); // swap reasons aren't shown

    fireEvent.press(getByLabelText('Bar Trench')); // tap the swap row

    expect(getByText('cocktails')).toBeTruthy(); // now the primary
    expect(queryByText('deep house')).toBeNull();
  });

  it('shows a no-match line when there are no candidates', () => {
    const { getByText } = render(<ChatPlaceCard toolResults={[toolResult([])]} />);
    expect(getByText("couldn't find a match")).toBeTruthy();
  });
});
