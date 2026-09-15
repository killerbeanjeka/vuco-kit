import { createI18n, deviceBestMatchLanguage } from '../../src/i18n';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';

type I18n = ReturnType<typeof createI18n>;

/**
 * Resolves once init has finished. With inline resources i18next initialises synchronously, so this is
 * normally settled already; awaiting it keeps the tests independent of that.
 */
function initialized(instance: I18n) {
  return new Promise<void>((resolve) => {
    if (instance.isInitialized) {
      resolve();
    } else {
      instance.on('initialized', () => resolve());
    }
  });
}

/** Recursively collect dotted leaf keys of a translation bundle. */
function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? leafKeys(value as Record<string, unknown>, path) : [path];
  });
}

function valueAt(bundle: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);
}

describe('kit strings', () => {
  it('every kit key is a non-empty string in both English and German', () => {
    const bundles: Record<string, Record<string, unknown>> = { en, de };
    const keys = [...new Set([...leafKeys(en), ...leafKeys(de)])].sort();
    const problems = Object.entries(bundles).flatMap(([lng, bundle]) =>
      keys
        .filter((key) => {
          const value = valueAt(bundle, key);
          return typeof value !== 'string' || value.trim() === '';
        })
        .map((key) => `${lng}: ${key} is missing or empty`),
    );
    expect(problems).toEqual([]);
  });
});

// A synthetic app: the kit never sees an app's real bundles. French is an app language the kit has no
// words for.
const APP = {
  en: { invoice: { title: 'Invoice' }, settings: { title: 'Settings' }, onlyInEnglish: 'English only' },
  de: { invoice: { title: 'Rechnung' }, settings: { title: 'Einstellungen' } },
  fr: { settings: { title: 'Réglages' } },
};

describe('createI18n (App Language mechanism, AD-13)', () => {
  const i18n = createI18n({ resources: APP, fallbackLng: 'en' });

  beforeAll(() => initialized(i18n));

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('starts in the device language (the jest device is en-US)', () => {
    expect(i18n.language).toBe('en');
  });

  it('serves the app strings and the kit namespace side by side', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('settings.title')).toBe('Einstellungen');
    expect(i18n.t('back', { ns: 'kit' })).toBe('Zurück');
    expect(i18n.t('close', { ns: 'kit' })).toBe('Schließen');
    await i18n.changeLanguage('en');
    expect(i18n.t('back', { ns: 'kit' })).toBe('Back');
    expect(i18n.t('close', { ns: 'kit' })).toBe('Close');
  });

  it('a key missing in German renders the fallback language, never the raw key', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('onlyInEnglish')).toBe('English only');
  });

  it('a language the kit has no words for renders the kit words in the fallback language', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('settings.title')).toBe('Réglages');
    expect(i18n.t('back', { ns: 'kit' })).toBe('Back');
    expect(i18n.t('close', { ns: 'kit' })).toBe('Close');
  });

  it('Document Language: with the App Language English, getFixedT("de") renders document text in German and the UI stays English', async () => {
    await i18n.changeLanguage('en');
    const documentT = i18n.getFixedT('de');
    expect(documentT('invoice.title')).toBe('Rechnung');
    expect(i18n.t('invoice.title')).toBe('Invoice');
    expect(i18n.t('settings.title')).toBe('Settings');
  });
});

describe('deviceBestMatchLanguage (the App Language before the user chooses, FR-43)', () => {
  const localization = jest.requireMock('expo-localization') as { getLocales: () => unknown[] };
  const original = localization.getLocales;

  afterEach(() => {
    localization.getLocales = original;
  });

  it('an English device best-matches en', () => {
    expect(deviceBestMatchLanguage()).toBe('en');
  });

  it('a German device best-matches de', () => {
    localization.getLocales = () => [{ languageCode: 'de', languageTag: 'de-DE' }];
    expect(deviceBestMatchLanguage()).toBe('de');
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('locale unavailable');
      },
    ],
    ['returns fr', () => [{ languageCode: 'fr', languageTag: 'fr-FR' }]],
    ['returns an empty list', () => []],
  ])('a device whose getLocales() %s gets en', (_case, getLocales) => {
    localization.getLocales = getLocales;
    expect(deviceBestMatchLanguage()).toBe('en');
  });

  it('a German device starts a fresh factory in German, kit words included', async () => {
    await jest.isolateModulesAsync(async () => {
      const isolatedLocalization = jest.requireMock('expo-localization') as { getLocales: () => unknown[] };
      isolatedLocalization.getLocales = () => [{ languageCode: 'de', languageTag: 'de-DE' }];
      const kit = jest.requireActual('../../src/i18n') as typeof import('../../src/i18n');
      const fresh = kit.createI18n({ resources: APP, fallbackLng: 'en' });
      await initialized(fresh);
      expect(fresh.language).toBe('de');
      expect(fresh.t('settings.title')).toBe('Einstellungen');
      expect(fresh.t('back', { ns: 'kit' })).toBe('Zurück');
    });
  });

  it('never blocks boot: when getLocales() throws, a fresh factory still initialises in en', async () => {
    await jest.isolateModulesAsync(async () => {
      const isolatedLocalization = jest.requireMock('expo-localization') as { getLocales: () => unknown[] };
      isolatedLocalization.getLocales = () => {
        throw new Error('locale unavailable');
      };
      const kit = jest.requireActual('../../src/i18n') as typeof import('../../src/i18n');
      const fresh = kit.createI18n({ resources: APP, fallbackLng: 'en' });
      await initialized(fresh);
      expect(fresh.language).toBe('en');
      expect(fresh.t('back', { ns: 'kit' })).toBe('Back');
    });
  });
});
