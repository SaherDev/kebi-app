import { View, Text } from 'react-native';
import { TopBar } from './top-bar';
import { IconButton } from './icon-button';
import { Mascot } from './mascot';
import { ScreenTitle } from './screen-title';
import { useTranslation } from '../i18n/context';

interface ChatScreenProps {
  /** Close the chat — runs the collapse-back-into-the-button animation. */
  onClose: () => void;
}

/**
 * The chat surface (kebi-chat-mockup). Rendered inside the circular-reveal
 * overlay (`ChatOverlay`), not as a routed screen — home stays mounted behind
 * it. The header X is the only close trigger; it calls `onClose`, which plays
 * the reverse wipe. The frame is inlined (not `ScreenScaffold`) so there's no
 * FAB and no import cycle through the scaffold — you're already in chat.
 */
export function ChatScreen({ onClose }: ChatScreenProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-bg">
      <TopBar
        left={<IconButton icon="close" label={t('common.close')} onPress={onClose} />}
        // Chat title-pill: mascot avatar + brand wordmark, screen-centered
        // between the close button and a balancing spacer (kebi-chat-mockup).
        center={
          <View className="flex-row items-center gap-2 rounded-full bg-surface py-2 pe-3.5 ps-2">
            <View className="h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-small">
              <Mascot size={22} />
            </View>
            <Text className="font-semibold text-[14px] text-text">kebi</Text>
          </View>
        }
        right={<View className="w-10" />}
      />
      <ScreenTitle title={t('titles.chat')} />
    </View>
  );
}
