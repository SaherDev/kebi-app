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
import { SaveSheetProvider } from "../components/save-sheet-context";
import { SavedPlacesProvider } from "../components/saved-places-context";
import { PlaceDetailProvider } from "../components/place-detail-context";
import { PlaceActionsProvider } from "../components/place-actions-context";
import { NoteSheetProvider } from "../components/note-sheet-context";
import { ChatProvider } from "../components/chat-context";
import { ChatTranscriptProvider } from "../components/chat-transcript-context";
import { ContextMenuProvider } from "../components/context-menu/context-menu-context";
import { Splash } from "../components/splash";
import { AuthProvider, useAuth } from "../auth/auth-context";
import { getStoredTheme } from "../lib/theme-preference";

// Keep the splash visible until the Inter weights are loaded.
SplashScreen.preventAutoHideAsync();

/**
 * Route guard. Once auth state resolves, sends signed-out users to the login
 * group and signed-in users out of it. Renders nothing — the redirect runs in an
 * effect under the boot splash, so there's no flash.
 */
function AuthGate() {
  // Routes by auth *status* only — the app never sees the session or user data.
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/login");
    } else if (status === "authenticated" && inAuthGroup) {
      router.replace("/");
    }
  }, [status, segments, router]);

  return null;
}

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  // Boot-only: the animated splash overlays the app on cold start, then unmounts
  // for good — never re-shown on in-app navigation (design-system Loading #1).
  const [splashDone, setSplashDone] = useState(false);
  // Apply the persisted theme before the first paint is revealed, so the app
  // never flashes the system theme then snaps to the user's choice.
  const [themeRestored, setThemeRestored] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    let cancelled = false;
    getStoredTheme()
      .then((stored) => {
        if (cancelled) return;
        if (stored) setColorScheme(stored);
      })
      .finally(() => {
        if (!cancelled) setThemeRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && themeRestored) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, themeRestored]);

  if ((!fontsLoaded && !fontError) || !themeRestored) {
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
                {/* SavedPlacesProvider holds the places saved this session (the
                    library reads from it); it wraps SaveSheetProvider so the save
                    flow can add to it. */}
                {/* PlaceActionsProvider owns the saved-place menu mutations
                    (looks right / like / been there / forget) + the optimistic
                    overrides store, shared by the library card and place page. */}
                <PlaceActionsProvider>
                <SavedPlacesProvider>
                {/* PlaceDetailProvider holds the place opened on the detail page;
                    the library card sets it before navigating to /place (path A). */}
                <PlaceDetailProvider>
                {/* NoteSheetProvider mounts the global note editor; any surface
                    raises it via useNoteSheet().open(view) — saves via place actions. */}
                <NoteSheetProvider>
                {/* SaveSheetProvider sits under ToastProvider so a save toast
                    renders above the sheet; it mounts the save sheet once and
                    lets home/library raise it via useSaveSheet(). */}
                <SaveSheetProvider>
                  <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                  {/* Redirects between the login group and the app once auth resolves. */}
                  <AuthGate />
                  {/* ChatTranscriptProvider sits ABOVE ChatProvider so the
                      conversation survives the chat overlay close→reopen (the
                      overlay unmounts its child); it resets on app restart. */}
                  <ChatTranscriptProvider>
                  {/* ChatProvider wraps the Stack so the circular-reveal chat
                      overlay renders above home (the origin FAB stays behind it),
                      but below the boot splash and toasts. */}
                  <ChatProvider>
                    {/* Native header off — every screen renders the custom TopBar instead. */}
                    <Stack screenOptions={{ headerShown: false }} />
                  </ChatProvider>
                  </ChatTranscriptProvider>
                  {/* Above the Stack, matching --bg, so the native splash hands off
                      without a flash; fades out to reveal home, then unmounts. */}
                  {!splashDone && <Splash onDone={() => setSplashDone(true)} />}
                </SaveSheetProvider>
                </NoteSheetProvider>
                </PlaceDetailProvider>
                </SavedPlacesProvider>
                </PlaceActionsProvider>
              </ToastProvider>
            </ContextMenuProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
