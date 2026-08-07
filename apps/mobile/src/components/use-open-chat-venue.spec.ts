import { renderHook } from '@testing-library/react-native';
import type { ChatEntity } from '@kebi-app/shared';
import { useOpenChatVenue } from './use-open-chat-venue';

const order: string[] = [];
const mockPush = jest.fn(() => order.push('push'));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const VAULT: ChatEntity = {
  kind: 'venue',
  key: 'vault-id',
  name: 'Vault Nightclub Bali',
  uri: 'kebi://venue/vault-id',
  icon: '🎶',
};

describe('useOpenChatVenue', () => {
  beforeEach(() => {
    order.length = 0;
    mockPush.mockClear();
  });

  const open = (closeChat: () => void, entity: ChatEntity = VAULT) => {
    const { result } = renderHook(() => useOpenChatVenue(closeChat));
    result.current(entity);
  };

  it('closes the chat BEFORE pushing the place — chat is an overlay above the stack', () => {
    const closeChat = jest.fn(() => order.push('close'));

    open(closeChat);

    // Pushing under an open chat lands the screen behind it — the tap then
    // looks like it did nothing, which is exactly the order this prevents.
    expect(order).toEqual(['close', 'push']);
  });

  it('passes the entity key as the place id, so an unsaved venue opens too', () => {
    open(jest.fn());

    // The key IS places.id (ADR-136), and GET /v1/places/{id} resolves it
    // whether or not the caller saved it (ADR-151) — no library lookup, so a
    // place kebi discovered this turn is as openable as a library row.
    // `from` is what tells the place screen to raise the chat again on pop.
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/place',
      params: { id: 'vault-id', from: 'chat' },
    });
  });

  it('ignores an area — only venues have a place screen to open', () => {
    const closeChat = jest.fn();

    open(closeChat, { ...VAULT, kind: 'area', uri: 'kebi://area/id/bali' });

    expect(mockPush).not.toHaveBeenCalled();
    expect(closeChat).not.toHaveBeenCalled();
  });
});
