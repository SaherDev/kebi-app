import { View, Text } from 'react-native';

/**
 * Placeholder body for the A3 navigation shell — a single lowercase screen
 * label. Replaced with real content per screen in Track C. No product data.
 */
export function ScreenTitle({ title }: { title: string }) {
  return (
    <View className="flex-1 px-6 pt-2">
      <Text className="font-bold text-title text-text">{title}</Text>
    </View>
  );
}
