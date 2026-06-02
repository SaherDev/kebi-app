import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { i18n, resolveDeviceLocale, type Locale, type Translate } from './i18n';

/**
 * React context for translations. The locale lives in state behind the
 * provider, so a future language switch re-renders consumers live (no remount).
 * Components call `useTranslation()` — they never import the i18n instance.
 */
interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

// Default value backs consumers rendered outside a provider — `t` still works
// (static, English); it just isn't reactive to a locale change.
const fallback: I18nContextValue = {
  get locale() {
    return i18n.locale as Locale;
  },
  setLocale: (locale: Locale) => {
    i18n.locale = locale;
  },
  t: (key, options) => i18n.t(key, options),
};

const I18nContext = createContext<I18nContextValue>(fallback);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveDeviceLocale());

  const setLocale = useCallback((next: Locale) => {
    i18n.locale = next;
    setLocaleState(next);
  }, []);

  // Keep the i18n instance aligned with state, then rebuild the context value
  // whenever the locale changes — its new identity (including a fresh `t`) is
  // what makes consumers re-render on a language switch.
  i18n.locale = locale;

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, options) => i18n.t(key, options),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Ergonomic parity with web's `useTranslations()` — call inside a component. */
export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}
