import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import en from './en.json';

/**
 * i18n instance + catalog config (no React). The context layer
 * (`./context`) owns the provider/hook; components consume it from there.
 *
 * English-only today, but every user-facing string and accessibility label
 * resolves through this catalog (never hardcoded). Web uses `next-intl`; this
 * is independent but mirrors its per-app, domain-namespaced catalog convention.
 */
export const i18n = new I18n({ en });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

/** The locales we ship a catalog for. Add a key here + a catalog to grow. */
export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Device locale, clamped to a locale we actually ship (else English). */
export function resolveDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (SUPPORTED_LOCALES as readonly string[]).includes(code) ? (code as Locale) : 'en';
}

export type Translate = (key: string, options?: Record<string, unknown>) => string;

// Resolve once at load so `t` works even before a provider mounts (e.g. a
// component rendered directly in a test). The provider keeps it in sync.
i18n.locale = resolveDeviceLocale();
