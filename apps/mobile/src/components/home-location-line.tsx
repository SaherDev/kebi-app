import { Text, View } from 'react-native';
import { Icon } from './icon';
import type { Weather } from '../lib/weather';

/**
 * The home top-bar location line (kebi-home-mockup `.location-row`):
 * `📍 shimokitazawa · 17° · clear`. Pure display chrome fed by `useHome`
 * (location is fetched once there, not twice). Degrades gracefully — shows just
 * the pin until a city/weather is resolved, so it never blocks the bar.
 */
interface HomeLocationLineProps {
  city: string | null;
  weather: Weather | null;
}

export function HomeLocationLine({ city, weather }: HomeLocationLineProps) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon name="pin" size={13} className="text-text-muted" />
      {city ? <Text className="text-small text-text-muted">{city.toLowerCase()}</Text> : null}
      {city && weather ? <View className="h-[3px] w-[3px] rounded-full bg-text-soft" /> : null}
      {weather ? (
        <Text className="text-small text-text-muted">{`${weather.tempC}° · ${weather.condition}`}</Text>
      ) : null}
    </View>
  );
}
