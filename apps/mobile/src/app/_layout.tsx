// react-native-gesture-handler must be the very first import in the app entry
// (the root layout) or gestures/navigation silently break on Android.
import "react-native-gesture-handler";
// NativeWind reads the design-token CSS variables compiled from this file.
import "../global.css";

import * as SplashScreen from "expo-splash-screen";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";

import { I18nProvider } from "../i18n/context";
import { ToastProvider } from "../components/toast-context";
import { ContextMenuProvider } from "../components/context-menu/context-menu-context";
import { Splash } from "../components/splash";
import { AuthProvider, useAuth } from "../auth/auth-context";

// Keep the splash visible until the Inter weights are loaded.
SplashScreen.preventAutoHideAsync();

/**
 * Route guard. Once auth state resolves, sends signed-out users to the login
 * group and signed-in users out of it. Renders nothing — the redirect runs in an
 * effect under the boot splash, so there's no flash.
 */
function AuthGate() {
  const { status, session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }
  }, [status, session, segments, router]);

  return null;
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  // Boot-only: the animated splash overlays the app on cold start, then unmounts
  // for good — never re-shown on in-app navigation (design-system Loading #1).
  const [splashDone, setSplashDone] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <SafeAreaProvider>
          <AuthProvider>
            {/* ContextMenuProvider wraps Toast so a long-press overlay (and its
                frosted blur) renders above the app but below toasts. */}
            <ContextMenuProvider>
              <ToastProvider>
                <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                {/* Redirects between the login group and the app once auth resolves. */}
                <AuthGate />
                {/* Native header off — every screen renders the custom TopBar instead. */}
                <Stack screenOptions={{ headerShown: false }} />
                {/* Above the Stack, matching --bg, so the native splash hands off
                    without a flash; fades out to reveal home, then unmounts. */}
                {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
              </ToastProvider>
            </ContextMenuProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
