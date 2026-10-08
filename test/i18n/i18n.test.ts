import { createI18n, deviceBestMatchLanguage } from '../../src/i18n';
import de from '../../src/i18n/de.json';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';
import pl from '../../src/i18n/pl.json';
import ro from '../../src/i18n/ro.json';
import tr from '../../src/i18n/tr.json';
import uk from '../../src/i18n/uk.json';

/** Every language the kit has words for (kit 0.9.0: vuco's seven App Languages). */
const KIT_BUNDLES: Record<string, Record<string, unknown>> = { en, de, es, pl, ro, tr, uk };

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
  it('every kit key is a non-empty string in every language the kit has words for', () => {
    const keys = [...new Set(Object.values(KIT_BUNDLES).flatMap((bundle) => leafKeys(bundle)))].sort();
    const problems = Object.entries(KIT_BUNDLES).flatMap(([lng, bundle]) =>
      keys
        .filter((key) => {
          const value = valueAt(bundle, key);
          return typeof value !== 'string' || value.trim() === '';
        })
        .map((key) => `${lng}: ${key} is missing or empty`),
    );
    expect(Object.keys(KIT_BUNDLES).sort()).toEqual(['de', 'en', 'es', 'pl', 'ro', 'tr', 'uk']);
    expect(keys).toEqual(['back', 'close']);
    expect(problems).toEqual([]);
  });

  it('no language repeats the English words (an untranslated copy would pass the check above)', () => {
    const copies = Object.entries(KIT_BUNDLES)
      .filter(([lng]) => lng !== 'en')
      .flatMap(([lng, bundle]) => leafKeys(en).filter((key) => valueAt(bundle, key) === valueAt(en, key)).map((key) => `${lng}: ${key}`));
    expect(copies).toEqual([]);
  });
});

describe('plural rules (the polyfill carries locale data for every kit language)', () => {
  // Importing the kit loads the polyfill and its locale data; i18next picks plural forms from these
  // categories, so a language without its data would silently lose `few` and `many`.
  it.each<[string, string[]]>([
    ['en', ['one', 'other']],
    ['de', ['one', 'other']],
    ['es', ['many', 'one', 'other']],
    ['pl', ['few', 'many', 'one', 'other']],
    ['ro', ['few', 'one', 'other']],
    ['tr', ['one', 'other']],
    ['uk', ['few', 'many', 'one', 'other']],
  ])('%s resolves its full CLDR category set', (lng, categories) => {
    expect([...new Intl.PluralRules(lng).resolvedOptions().pluralCategories].sort()).toEqual(categories);
  });

  it('Ukrainian 22 is few, 21 is one and 5 is many; Romanian 22 is other and 0 is few', () => {
    const ukRules = new Intl.PluralRules('uk');
    expect(ukRules.select(22)).toBe('few');
    expect(ukRules.select(21)).toBe('one');
    expect(ukRules.select(5)).toBe('many');
    const roRules = new Intl.PluralRules('ro');
    expect(roRules.select(22)).toBe('other');
    expect(roRules.select(0)).toBe('few');
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

  // Kit 0.9.0: an app passes the languages it has bundles for. The first device locale is matched
  // exactly; nothing else counts.
  const SEVEN = ['de', 'en', 'es', 'pl', 'ro', 'tr', 'uk'] as const;

  it.each<[string, { languageCode: string; languageTag: string }[], string]>([
    ['a Ukrainian device', [{ languageCode: 'uk', languageTag: 'uk-UA' }], 'uk'],
    ['a Polish device with German second', [{ languageCode: 'pl', languageTag: 'pl-PL' }, { languageCode: 'de', languageTag: 'de-DE' }], 'pl'],
    ['a Romanian device', [{ languageCode: 'ro', languageTag: 'ro-RO' }], 'ro'],
    ['a Turkish device', [{ languageCode: 'tr', languageTag: 'tr-TR' }], 'tr'],
    ['a Spanish (Mexico) device', [{ languageCode: 'es', languageTag: 'es-MX' }], 'es'],
    ['a German device with Ukrainian second (the first locale wins)', [{ languageCode: 'de', languageTag: 'de-DE' }, { languageCode: 'uk', languageTag: 'uk-UA' }], 'de'],
    ['a Russian device', [{ languageCode: 'ru', languageTag: 'ru-RU' }], 'en'],
    ['a Russian-in-Ukraine device', [{ languageCode: 'ru', languageTag: 'ru-UA' }], 'en'],
    ['a French device', [{ languageCode: 'fr', languageTag: 'fr-FR' }], 'en'],
    ['a device with no locales', [], 'en'],
  ])('with a supported list, %s gets the matching language', (_case, locales, expected) => {
    localization.getLocales = () => locales;
    expect(deviceBestMatchLanguage(SEVEN)).toBe(expected);
  });

  it('with a supported list, a device whose getLocales() throws gets en', () => {
    localization.getLocales = () => {
      throw new Error('locale unavailable');
    };
    expect(deviceBestMatchLanguage(SEVEN)).toBe('en');
  });

  it('without a supported list, a Polish or Ukrainian device still gets en (vuco:walk as on kit 0.8.0)', () => {
    localization.getLocales = () => [{ languageCode: 'pl', languageTag: 'pl-PL' }];
    expect(deviceBestMatchLanguage()).toBe('en');
    localization.getLocales = () => [{ languageCode: 'uk', languageTag: 'uk-UA' }];
    expect(deviceBestMatchLanguage()).toBe('en');
  });

  it('an app with only en and de bundles starts in English on a Polish device (vuco:walk as on kit 0.8.0)', async () => {
    await jest.isolateModulesAsync(async () => {
      const isolatedLocalization = jest.requireMock('expo-localization') as { getLocales: () => unknown[] };
      isolatedLocalization.getLocales = () => [{ languageCode: 'pl', languageTag: 'pl-PL' }];
      const kit = jest.requireActual('../../src/i18n') as typeof import('../../src/i18n');
      const fresh = kit.createI18n({ resources: { en: APP.en, de: APP.de }, fallbackLng: 'en' });
      await initialized(fresh);
      expect(fresh.language).toBe('en');
      expect(fresh.t('back', { ns: 'kit' })).toBe('Back');
    });
  });

  it('an app with a Ukrainian bundle starts in Ukrainian on a Ukrainian device, kit words included', async () => {
    await jest.isolateModulesAsync(async () => {
      const isolatedLocalization = jest.requireMock('expo-localization') as { getLocales: () => unknown[] };
      isolatedLocalization.getLocales = () => [{ languageCode: 'uk', languageTag: 'uk-UA' }];
      const kit = jest.requireActual('../../src/i18n') as typeof import('../../src/i18n');
      const fresh = kit.createI18n({
        resources: { ...APP, uk: { settings: { title: 'Налаштування' }, items_one: '{{count}} позиція', items_few: '{{count}} позиції', items_many: '{{count}} позицій', items_other: '{{count}} позиції' } },
        fallbackLng: 'en',
      });
      await initialized(fresh);
      expect(fresh.language).toBe('uk');
      expect(fresh.t('settings.title')).toBe('Налаштування');
      expect(fresh.t('back', { ns: 'kit' })).toBe('Назад');
      expect(fresh.t('close', { ns: 'kit' })).toBe('Закрити');
      // i18next picks the Ukrainian plural forms from the polyfill's categories.
      expect([1, 2, 5, 21, 22].map((count) => fresh.t('items', { count }))).toEqual([
        '1 позиція',
        '2 позиції',
        '5 позицій',
        '21 позиція',
        '22 позиції',
      ]);
    });
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
