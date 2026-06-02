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

import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";

import { I18nProvider } from "../i18n/context";
import { ToastProvider } from "../components/toast-context";

// Keep the splash visible until the Inter weights are loaded.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
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
    <I18nProvider>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          {/* Native header off — every screen renders the custom TopBar instead. */}
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </SafeAreaProvider>
    </I18nProvider>
  );
}
