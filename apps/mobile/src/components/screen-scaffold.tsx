import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KebiFab } from './kebi-fab';
import { useChat } from './chat-context';

interface ScreenScaffoldProps {
  /** The top-bar element for this screen. */
  topBar?: ReactNode;
  children: ReactNode;
  /** Hide the floating AI button (chat screen — you're already in it). */
  showFab?: boolean;
}

/**
 * Standard screen frame: page background + top bar + content + the floating AI
 * button (overlaid on every screen except chat). The FAB opens the chat overlay,
 * which reveals in a circular wipe from the button while this screen stays put.
 */
export function ScreenScaffold({ topBar, children, showFab = true }: ScreenScaffoldProps) {
  const chat = useChat();
  return (
    <View className="flex-1 bg-bg">
      {topBar}
      {children}
      {showFab ? <KebiFab onPress={chat.open} /> : null}
    </View>
  );
}
