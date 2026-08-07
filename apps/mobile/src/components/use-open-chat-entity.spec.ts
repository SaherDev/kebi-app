import { renderHook } from '@testing-library/react-native';
import type { ChatEntity } from '@kebi-app/shared';
import { useOpenChatEntity } from './use-open-chat-entity';

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

/** An area identifies by the opaque token on its `uri`, not by `key`. */
const CANGGU: ChatEntity = {
  kind: 'area',
  key: 'id/bali/canggu',
  name: 'Canggu',
  uri: 'kebi://area/aWQvYmFsaS9jYW5nZ3U',
  icon: '🏄',
};

describe('useOpenChatEntity', () => {
  beforeEach(() => {
    order.length = 0;
    mockPush.mockClear();
  });

  const open = (closeChat: () => void, entity: ChatEntity) => {
    const { result } = renderHook(() => useOpenChatEntity(closeChat));
    result.current(entity);
  };

  it('closes the chat BEFORE pushing — chat is an overlay above the stack', () => {
    const closeChat = jest.fn(() => order.push('close'));

    open(closeChat, VAULT);

    // Pushing under an open chat lands the screen behind it — the tap then
    // looks like it did nothing, which is exactly the order this prevents.
    expect(order).toEqual(['close', 'push']);
  });

  it('passes a venue key as the place id, so an unsaved venue opens too', () => {
    open(jest.fn(), VAULT);

    // The key IS places.id (ADR-136), and GET /v1/places/{id} resolves it
    // whether or not the caller saved it (ADR-151).
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/place',
      params: { id: 'vault-id', from: 'chat' },
    });
  });

  it('opens an area with the token off its uri, never its raw geo key', () => {
    open(jest.fn(), CANGGU);

    // `key` is `id/bali/canggu` — a slash path no endpoint takes (ADR-153).
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/area',
      params: { id: 'aWQvYmFsaS9jYW5nZ3U', from: 'chat' },
    });
  });

  it('leaves chat open when an entity carries no id to open', () => {
    const closeChat = jest.fn();

    open(closeChat, { ...CANGGU, uri: 'kebi://area/' });

    // Closing the conversation to navigate nowhere is the worst outcome.
    expect(mockPush).not.toHaveBeenCalled();
    expect(closeChat).not.toHaveBeenCalled();
  });
});
