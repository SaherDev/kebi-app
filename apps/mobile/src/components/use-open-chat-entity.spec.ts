import { Linking } from 'react-native';
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

/** A web source's `key` is the raw page URL (ADR-161) — no resolve endpoint. */
const FIFA: ChatEntity = {
  kind: 'web',
  key: 'https://www.fifa.com/tournaments/mens/worldcup/schedule',
  name: 'fifa.com',
  uri: 'kebi://web/aHR0cHM6Ly93d3cuZmlmYS5jb20',
  icon: '🌐',
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
      // Name and icon ride along so a destination that has no seed can paint
      // its title on the first frame (ADR-056).
      params: expect.objectContaining({ id: 'vault-id', from: 'chat' }),
    });
  });

  it('opens an area with the token off its uri, never its raw geo key', () => {
    open(jest.fn(), CANGGU);

    // `key` is `id/bali/canggu` — a slash path no endpoint takes (ADR-153).
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/area',
      params: expect.objectContaining({ id: 'aWQvYmFsaS9jYW5nZ3U', from: 'chat' }),
    });
    // The chip already knew what it was pointing at — the area screen shows
    // that name while it fetches, instead of an anonymous grey screen.
    expect(mockPush.mock.calls[0][0].params).toMatchObject({ name: 'Canggu' });
  });

  it('leaves chat open when an entity carries no id to open', () => {
    const closeChat = jest.fn();

    open(closeChat, { ...CANGGU, uri: 'kebi://area/' });

    // Closing the conversation to navigate nowhere is the worst outcome.
    expect(mockPush).not.toHaveBeenCalled();
    expect(closeChat).not.toHaveBeenCalled();
  });

  it('opens a web source in the browser and keeps the conversation on screen', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    const closeChat = jest.fn();

    open(closeChat, FIFA);

    // The page URL travels as `key` (ADR-161) — handed to the OS verbatim.
    expect(openURL).toHaveBeenCalledWith(
      'https://www.fifa.com/tournaments/mens/worldcup/schedule',
    );
    // The browser layers above the app, so chat must still be there on return
    // — and nothing was pushed under it.
    expect(closeChat).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
