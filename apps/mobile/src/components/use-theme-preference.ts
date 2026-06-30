import { useCallback, useEffect, useState } from 'react';
import { useColorScheme } from 'nativewind';
import { triggerHaptic } from '../lib/haptics';
import {
  getStoredTheme,
  setStoredTheme,
  type ThemeChoice,
} from '../lib/theme-preference';

/**
 * The appearance control's state. NativeWind's `colorScheme` resolves `system`
 * to the concrete light/dark it's currently showing, so it can't tell us which
 * of the three the user *picked* — we track the raw choice here, restoring it
 * from storage on mount (the root layout also restores at boot to avoid a
 * flash; this keeps the segmented control's selection in sync).
 */
export interface UseThemePreference {
  choice: ThemeChoice;
  setChoice: (choice: ThemeChoice) => void;
}

export function useThemePreference(): UseThemePreference {
  const { setColorScheme } = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  useEffect(() => {
    let cancelled = false;
    getStoredTheme().then((stored) => {
      if (!cancelled && stored) setChoiceState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setChoice = useCallback(
    (next: ThemeChoice) => {
      setChoiceState(next);
      setColorScheme(next);
      void setStoredTheme(next);
      triggerHaptic('theme-toggle');
    },
    [setColorScheme],
  );

  return { choice, setChoice };
}
