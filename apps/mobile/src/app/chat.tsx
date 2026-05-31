import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenScaffold } from '../components/screen-scaffold';
import { TopBar } from '../components/top-bar';
import { IconButton } from '../components/icon-button';
import { Mascot } from '../components/mascot';
import { ScreenTitle } from '../components/screen-title';

export default function ChatScreen() {
  const router = useRouter();
  return (
    <ScreenScaffold
      showFab={false}
      topBar={
        <TopBar
          left={<IconButton icon="close" label="close" onPress={() => router.back()} />}
          // Chat title-pill: mascot avatar + brand wordmark (kebi-chat-mockup).
          right={
            <View className="flex-row items-center gap-2 rounded-full bg-surface py-2 pe-3.5 ps-2">
              <View className="h-[22px] w-[22px] items-center justify-center overflow-hidden rounded-small">
                <Mascot size={22} />
              </View>
              <Text className="font-semibold text-[14px] text-text">kebi</Text>
            </View>
          }
        />
      }
    >
      <ScreenTitle title="chat" />
    </ScreenScaffold>
  );
}
