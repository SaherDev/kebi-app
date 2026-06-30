import { View, Text } from 'react-native';

/**
 * The user's avatar on the settings screen (kebi-settings-mockup.html
 * `.profile-avatar`) — the display name's first letter on a `--surface` rounded
 * square. Distinct from PlaceAvatar (which is emoji-only and never a letter).
 * Falls back to the email's initial, then a neutral dot when the user has
 * neither yet (phone-only signup before they set a name). Light/dark automatic.
 */
interface ProfileAvatarProps {
  /** Display name; its first letter is shown. */
  name?: string;
  /** Used for the initial when name is empty. */
  email?: string;
}

function initialFrom(name?: string, email?: string): string {
  const source = name?.trim() || email?.trim() || '';
  const first = source[0];
  return first ? first.toUpperCase() : '·';
}

export function ProfileAvatar({ name, email }: ProfileAvatarProps) {
  return (
    <View
      accessibilityRole="image"
      className="h-14 w-14 items-center justify-center rounded-large bg-surface"
    >
      <Text className="text-subtitle font-bold text-text">{initialFrom(name, email)}</Text>
    </View>
  );
}
