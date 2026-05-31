import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { KebiFab } from './kebi-fab';

interface ScreenScaffoldProps {
  /** The top-bar element for this screen. */
  topBar?: ReactNode;
  children: ReactNode;
  /** Hide the floating AI button (chat screen — you're already in it). */
  showFab?: boolean;
}

/**
 * Standard screen frame: page background + top bar + content + the floating AI
 * button (overlaid on every screen except chat). The FAB routes to the chat
 * consult screen.
 */
export function ScreenScaffold({ topBar, children, showFab = true }: ScreenScaffoldProps) {
  const router = useRouter();
  return (
    <View className="flex-1 bg-bg">
      {topBar}
      {children}
      {showFab ? <KebiFab onPress={() => router.push('/chat')} /> : null}
    </View>
  );
}
