// URL polyfill must load before supabase-js — React Native lacks a complete
// URL implementation, which supabase-js relies on internally.
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

// Both are public/publishable (the anon/publishable key), safe to inline.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set",
  );
}

/**
 * Single Supabase client for the app. Session is persisted in AsyncStorage and
 * auto-refreshed while the app is foregrounded. `detectSessionInUrl` is off —
 * that browser-only flow doesn't apply in React Native (OAuth returns via a
 * deep link we handle explicitly).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's documented React Native pattern: only auto-refresh the session
// while the app is active, to avoid background refresh churn.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
