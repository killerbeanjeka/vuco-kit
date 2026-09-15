// Hermes still ships without Intl.PluralRules (verified 2026-07) — polyfill before i18next
// init. Force variants per formatjs RN guidance: the detection variants are slow/unreliable
// on Hermes, and the researched lane (story Task 5.1) pins polyfill-force.
import '@formatjs/intl-getcanonicallocales/polyfill-force.js';
import '@formatjs/intl-locale/polyfill-force.js';
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/de.js';

import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './de.json';
import en from './en.json';

// The words the kit's own primitives render (ScreenHeader's back / close labels), per language.
const KIT_STRINGS: Record<string, Record<string, string>> = { en, de };

export interface CreateI18nOptions {
  /** The app's strings, one bundle per language; each becomes that language's `translation` namespace. */
  resources: Record<string, Record<string, unknown>>;
  /** The language a missing key renders in. */
  fallbackLng: string;
}

/**
 * Best-match App Language from the device locale (FR-43: picker pre-highlight,
 * and the pre-choice UI language). getLocales() is synchronous, so createI18n
 * starts in it; an app that stores the user's choice applies it on top, before
 * first paint.
 */
export function deviceBestMatchLanguage(): 'en' | 'de' {
  try {
    return getLocales()[0]?.languageCode === 'de' ? 'de' : 'en';
  } catch {
    return 'en'; // English is the base locale — never block boot on locale detection
  }
}

/**
 * Initialises the default i18next instance — the App Language mechanism (AD-13) — with the app's
 * strings in the default `translation` namespace and the kit's strings in `kit`, and returns it.
 * Call it once, at app start. Document text rendered on the device uses `getFixedT(documentLanguage)`
 * on this same instance; the server's pack wordings are a separate system.
 */
export function createI18n({ resources, fallbackLng }: CreateI18nOptions) {
  const merged = Object.fromEntries(
    Object.entries(resources).map(([lng, translation]) => [lng, { translation, kit: KIT_STRINGS[lng] ?? {} }]),
  );

  i18n
    .use(initReactI18next)
    .init({
      resources: merged,
      lng: deviceBestMatchLanguage(),
      fallbackLng, // missing de keys render English — never raw keys (AR-15)
      interpolation: { escapeValue: false },
    })
    .catch((error: unknown) => {
      console.error('[vuco/i18n] init failed', error);
    });

  return i18n;
}
