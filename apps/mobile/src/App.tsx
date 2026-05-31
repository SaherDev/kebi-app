/**
 * Kebi — token-preview screen (A2).
 *
 * Renders every design token as a visual swatch so we can verify the NativeWind
 * theme (colors, type scale, spacing, radii, pills, buttons) against
 * kebi-tokens-mockup.html before building real screens.
 *
 * Light/dark toggle calls nativewind's setColorScheme so the entire palette
 * swaps; no component contains a hex value.
 *
 * This file will be replaced by the Expo Router root layout in Track A3.
 */
import './global.css';

import React, { useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useColorScheme } from 'nativewind';

// Keep the splash visible until fonts are loaded.
SplashScreen.preventAutoHideAsync();

// ── Helpers ──────────────────────────────────────────────────────────────────

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <View className="mb-8">
      <Text className="mb-3 font-semibold text-eyebrow text-text-soft uppercase tracking-widest">
        {label}
      </Text>
      {children}
    </View>
  );
}

// ── Theme toggle (segmented control — matches .theme-toggle in the mockup) ─────
// Pill container (surface bg, 3px padding) with two segments; the active one
// is filled with `--text` on `--bg`, inactive is transparent / text-muted.

interface ThemeToggleProps {
  isDark: boolean;
  onSelect: (scheme: 'light' | 'dark') => void;
}

function ThemeToggle({ isDark, onSelect }: ThemeToggleProps) {
  const segments = ['light', 'dark'] as const;
  return (
    <View className="flex-row bg-surface rounded-full p-[3px]">
      {segments.map((segment) => {
        const active = (segment === 'dark') === isDark;
        return (
          <TouchableOpacity
            key={segment}
            onPress={() => onSelect(segment)}
            className={`rounded-full px-3 py-[6px] ${active ? 'bg-text' : 'bg-transparent'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${segment} mode`}
          >
            <Text
              className={`font-medium text-[12px] ${active ? 'text-bg' : 'text-text-muted'}`}
            >
              {segment}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Token-preview screen ──────────────────────────────────────────────────────

function TokenPreview() {
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const selectScheme = useCallback(
    (scheme: 'light' | 'dark') => {
      setColorScheme(scheme);
    },
    [setColorScheme],
  );

  return (
    <View className="flex-1 bg-bg">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top bar */}
      <View
        className="flex-row items-center justify-between px-6 border-b border-surface-2 bg-bg"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <Text className="font-bold text-title text-text tracking-[-0.70px]">
          kebi tokens
        </Text>
        <ThemeToggle isDark={isDark} onSelect={selectScheme} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 24,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 01 Canvas colors ── */}
        <Section label="01 · canvas">
          <View className="flex-row gap-3">
            {([
              { label: 'bg', cls: 'bg-bg' },
              { label: 'surface', cls: 'bg-surface' },
              { label: 'surface-2', cls: 'bg-surface-2' },
            ] as const).map((swatch) => (
              <View key={swatch.label} className="flex-1 rounded-card border border-surface-2 overflow-hidden">
                <View className={`h-16 ${swatch.cls}`} />
                <View className="ps-3 pe-2 py-2 bg-surface">
                  <Text className="font-semibold text-small text-text">{swatch.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* ── 02 Text colors ── */}
        <Section label="02 · text">
          <View className="rounded-card bg-surface border border-surface-2 ps-4 pe-4 py-3 gap-2">
            <Text className="font-bold text-body text-text">text — primary copy</Text>
            <Text className="font-medium text-body text-text-muted">text-muted — meta, sub-labels</Text>
            <Text className="font-medium text-body text-text-soft">text-soft — timestamps, eyebrows</Text>
          </View>
        </Section>

        {/* ── 03 Semantic colors ── */}
        <Section label="03 · semantic">
          <View className="flex-row flex-wrap gap-3">
            {([
              { label: 'success', cls: 'bg-success' },
              { label: 'like', cls: 'bg-like' },
              { label: 'warn', cls: 'bg-warn' },
              { label: 'danger', cls: 'bg-danger' },
            ] as const).map((s) => (
              <View key={s.label} className="flex-1 min-w-[72px] rounded-card overflow-hidden border border-surface-2">
                <View className={`h-12 ${s.cls}`} />
                <View className="ps-2 pe-1 py-2 bg-surface">
                  <Text className="font-semibold text-small text-text">{s.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </Section>

        {/* ── 04 Status pills ── */}
        <Section label="04 · pills">
          <View className="rounded-card bg-surface border border-surface-2 ps-4 pe-4 py-4">
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-row items-center gap-1 bg-pill-green-bg rounded-full px-3 py-1">
                <View className="w-[5px] h-[5px] rounded-full bg-success" />
                <Text className="font-semibold text-eyebrow text-success">saved</Text>
              </View>
              <View className="flex-row items-center gap-1 bg-pill-warm-bg rounded-full px-3 py-1">
                <View className="w-[5px] h-[5px] rounded-full bg-like" />
                <Text className="font-semibold text-eyebrow text-like">new</Text>
              </View>
              <View className="flex-row items-center gap-1 bg-pill-amber-bg rounded-full px-3 py-1">
                <View className="w-[5px] h-[5px] rounded-full bg-warn" />
                <Text className="font-semibold text-eyebrow text-warn">approve?</Text>
              </View>
              <View className="flex-row items-center gap-1 bg-pill-danger-bg rounded-full px-3 py-1">
                <View className="w-[5px] h-[5px] rounded-full bg-danger" />
                <Text className="font-semibold text-eyebrow text-danger">closed</Text>
              </View>
            </View>
          </View>
        </Section>

        {/* ── 05 Type scale ── */}
        <Section label="05 · type scale">
          <View className="rounded-card bg-surface border border-surface-2 ps-4 pe-4 py-3 gap-3">
            <View>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase mb-1">hero 32</Text>
              <Text className="font-bold text-hero text-text">it's late, drunk food?</Text>
            </View>
            <View>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase mb-1">title 28</Text>
              <Text className="font-bold text-title text-text">Saint Jardim</Text>
            </View>
            <View>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase mb-1">subtitle 18</Text>
              <Text className="font-bold text-subtitle text-text">your stash</Text>
            </View>
            <View>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase mb-1">body 15</Text>
              <Text className="font-sans text-body text-text">natural wine, 6 seats at the counter.</Text>
            </View>
            <View>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase mb-1">small 13</Text>
              <Text className="font-medium text-small text-text-muted">portuguese · ¥¥¥ · 8 min</Text>
            </View>
            <View>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase mb-1">eyebrow 11</Text>
              <Text className="font-semibold text-eyebrow text-text-soft uppercase">SUBSCRIPTION</Text>
            </View>
          </View>
        </Section>

        {/* ── 06 Spacing scale ── */}
        <Section label="06 · spacing (fixed scale only)">
          <View className="rounded-card bg-surface border border-surface-2 ps-4 pe-4 py-3 gap-2">
            {([
              { label: 'space-1 · 4px', width: 4 },
              { label: 'space-2 · 8px', width: 8 },
              { label: 'space-3 · 12px', width: 12 },
              { label: 'space-4 · 14px', width: 14 },
              { label: 'space-5 · 16px', width: 16 },
              { label: 'space-6 · 24px', width: 24 },
              { label: 'space-8 · 32px', width: 32 },
            ] as const).map((row) => (
              <View key={row.label} className="flex-row items-center gap-3">
                <View
                  className="bg-text rounded-tiny"
                  style={{ width: row.width, height: 14, flexShrink: 0 }}
                />
                <Text className="font-medium text-small text-text-muted">{row.label}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* ── 07 Radii ── */}
        <Section label="07 · radius">
          <View className="flex-row flex-wrap gap-3">
            {([
              { label: 'tiny\n4px',   r: 4,    desc: 'chips' },
              { label: 'small\n7px',  r: 7,    desc: 'avatars' },
              { label: 'medium\n10px',r: 10,   desc: 'buttons' },
              { label: 'card\n12px',  r: 12,   desc: 'cards' },
              { label: 'large\n14px', r: 14,   desc: 'groups' },
              { label: 'full\n999px', r: 9999, desc: 'pills' },
            ] as const).map((item) => (
              <View
                key={item.label}
                className="items-center bg-surface border border-surface-2 py-4 px-3"
                style={{ borderRadius: item.r, minWidth: 72, flex: 1 }}
              >
                <View
                  className="bg-text mb-2"
                  style={{ width: 40, height: 40, borderRadius: item.r }}
                />
                <Text className="font-semibold text-small text-text text-center">{item.label}</Text>
                <Text className="text-eyebrow text-text-soft text-center">{item.desc}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* ── 08 Buttons ── */}
        <Section label="08 · buttons">
          <View className="rounded-card bg-surface border border-surface-2 ps-4 pe-4 py-4">
            <View className="flex-row gap-3">
              {/* Primary: text on bg */}
              <TouchableOpacity
                className="rounded-medium bg-text ps-4 pe-4 py-2"
                accessibilityRole="button"
              >
                <Text className="font-semibold text-body text-bg">good pick</Text>
              </TouchableOpacity>
              {/* Outlined */}
              <TouchableOpacity
                className="rounded-medium border border-surface-2 ps-4 pe-4 py-2"
                accessibilityRole="button"
              >
                <Text className="font-semibold text-body text-text">not it</Text>
              </TouchableOpacity>
              {/* Danger */}
              <TouchableOpacity
                className="rounded-medium bg-danger ps-4 pe-4 py-2"
                accessibilityRole="button"
              >
                <Text className="font-semibold text-body" style={{ color: '#FFFFFF' }}>do it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* ── Platform note ── */}
        <View className="items-center mb-4">
          <Text className="text-eyebrow text-text-soft">
            {Platform.OS} · nativewind v4 · tailwind v3.4
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {/* onLayoutRootView hides the splash once fonts have loaded or errored. */}
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <TokenPreview />
      </View>
    </SafeAreaProvider>
  );
}

export default App;
