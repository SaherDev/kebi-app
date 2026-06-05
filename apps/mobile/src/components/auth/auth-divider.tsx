import { Text, View } from 'react-native';

/**
 * The "or" separator between the social-auth group and the email/phone input
 * (kebi-login-mockup.html `.auth-divider`): an uppercase eyebrow label flanked
 * by 1px hairlines on `--surface-2`.
 *
 * Presentational only — pass an already-translated `label`.
 */
interface AuthDividerProps {
  /** Divider text — pass an already-translated string (e.g. "or"). */
  label: string;
}

export function AuthDivider({ label }: AuthDividerProps) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-surface-2" />
      <Text className="text-eyebrow font-semibold uppercase text-text-soft">{label}</Text>
      <View className="h-px flex-1 bg-surface-2" />
    </View>
  );
}
