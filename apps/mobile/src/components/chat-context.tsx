import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ChatOverlay } from './chat-overlay';

/**
 * Chat host. A `ChatProvider` mounts the circular-reveal overlay once and
 * exposes `useChat().open()` so the floating AI button (on every scaffolded
 * screen) raises the same chat surface. Mirrors the save-sheet/toast provider
 * pattern: provider + hook + no-op fallback. The overlay owns the open/close
 * wipe and unmounts itself when the collapse finishes.
 */
interface ChatContextValue {
  open: () => void;
}

// No-op fallback so useChat() outside a provider is harmless (matches useToast).
const fallback: ChatContextValue = { open: () => undefined };
const ChatContext = createContext<ChatContextValue>(fallback);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<ChatContextValue>(() => ({ open }), [open]);

  return (
    <ChatContext.Provider value={value}>
      {children}
      <ChatOverlay open={isOpen} onClose={close} />
    </ChatContext.Provider>
  );
}

/** Open the chat from anywhere under a ChatProvider. */
export function useChat(): ChatContextValue {
  return useContext(ChatContext);
}
