/**
 * Kebi mobile — scaffold shell (A1).
 *
 * Renders a runtime value from @kebi-app/shared to verify the Metro resolver
 * picks up libs/shared via the @kebi-app/source export condition.
 * PlaceCore is also annotated to exercise TS type resolution.
 * This file will be replaced once Track A3 (Expo Router nav) lands.
 */
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOVEMENT_MODES, type PlaceCore } from '@kebi-app/shared';

// Type-only check — ensures @kebi-app/shared types resolve in the mobile app.
// This constant is never rendered; it exists only for the TS compiler.
const _typeSmokeTest: PlaceCore = {
  id: 'smoke',
  provider_id: null,
  place_name: 'Smoke Test Place',
  place_name_aliases: [],
  categories: [],
  tags: [],
  location: null,
  created_at: new Date().toISOString(),
  refreshed_at: null,
};
void _typeSmokeTest; // prevent unused-variable lint

export const App = () => (
  <SafeAreaView style={styles.container}>
    {/* eslint-disable-next-line react/style-prop-object -- expo-status-bar uses `style` as a string enum, not a RN style object */}
  <StatusBar style="dark" />
    <View style={styles.content}>
      <Text style={styles.title}>Kebi</Text>
      <Text style={styles.subtitle}>Scaffold shell — A1</Text>

      {/* Runtime proof: MOVEMENT_MODES from @kebi-app/shared */}
      <View style={styles.card}>
        <Text style={styles.label}>@kebi-app/shared → MOVEMENT_MODES</Text>
        <Text style={styles.value}>{MOVEMENT_MODES.join(' · ')}</Text>
      </View>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7c3aed',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    color: '#1a1a1a',
  },
});

export default App;
