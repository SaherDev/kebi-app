import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredTheme, setStoredTheme } from './theme-preference';

describe('theme-preference', () => {
  beforeEach(() => AsyncStorage.clear());

  it('returns null when nothing is stored', async () => {
    expect(await getStoredTheme()).toBeNull();
  });

  it('round-trips a stored choice', async () => {
    await setStoredTheme('dark');
    expect(await getStoredTheme()).toBe('dark');
  });

  it('ignores a corrupted stored value', async () => {
    await AsyncStorage.setItem('kebi.theme', 'neon');
    expect(await getStoredTheme()).toBeNull();
  });
});
