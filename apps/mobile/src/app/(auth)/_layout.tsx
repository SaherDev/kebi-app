import { Stack } from 'expo-router';

/**
 * Auth route group. Headerless like the rest of the app (each screen renders its
 * own chrome). The app isn't gated yet — that AuthProvider + redirect guard
 * arrives in the wiring pass; for now these screens are reachable directly
 * (e.g. /login) and shown in the gallery.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
