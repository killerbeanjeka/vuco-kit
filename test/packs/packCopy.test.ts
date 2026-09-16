// The copy-drift row of the Story 15.3 I/O matrix: a differing value, a path missing on either side,
// and a selector matching no element or several all fail, and the failure names both paths.
import {
  assertPackCopy,
  packCopyMismatches,
  type PackCopyMismatch,
  type PackCopyPairs,
} from '../../src/packs/packCopy';

const pack = {
  packId: 'aa',
  version: '1.4.0',
  taxRuleTable: {
    rates: [
      { key: 'standard', ratePercent: 20, label: { en: 'Standard rate', fr: 'Taux normal' } },
      { key: 'reduced', ratePercent: 10, label: { en: 'Reduced rate', fr: 'Taux réduit' } },
      { key: 'zero', ratePercent: 0, label: { en: 'Zero rate', fr: 'Taux zéro' } },
    ],
  },
  documentWordings: { wordings: { title: { en: 'Extra work', fr: 'Travaux supplémentaires' } } },
  chaseLadder: {
    status: 'complete',
    steps: [
      { key: 'first', offsetDays: 3, active: true },
      { key: 'second', offsetDays: 14, active: false },
    ],
  },
};

function copy() {
  return {
    packId: 'aa',
    packVersion: '1.4.0',
    rates: [
      { key: 'standard', ratePercent: 20 },
      { key: 'reduced', ratePercent: 10 },
    ],
    // Same content, keys in another order: still equal.
    wordings: { title: { fr: 'Travaux supplémentaires', en: 'Extra work' } },
    chaseLadder: {
      steps: [
        { active: true, offsetDays: 3, key: 'first' },
        { key: 'second', offsetDays: 14, active: false },
      ],
      status: 'complete',
    },
  };
}

const PAIRS: PackCopyPairs = {
  packId: 'packId',
  packVersion: 'version',
  'rates[key=standard].ratePercent': 'taxRuleTable.rates[key=standard].ratePercent',
  'rates[key=reduced].ratePercent': 'taxRuleTable.rates[key=reduced].ratePercent',
  'wordings.title': 'documentWordings.wordings.title',
  chaseLadder: 'chaseLadder',
};

describe('packCopyMismatches / assertPackCopy', () => {
  it('passes a copy that matches the pack on every pair', () => {
    expect(packCopyMismatches(pack, copy(), PAIRS)).toEqual([]);
    expect(() => assertPackCopy(pack, copy(), PAIRS)).not.toThrow();
  });

  it('reports a differing value with both paths and both values', () => {
    const drifted = copy();
    drifted.rates[0].ratePercent = 19;
    expect(packCopyMismatches(pack, drifted, PAIRS)).toEqual([
      {
        copyPath: 'rates[key=standard].ratePercent',
        packPath: 'taxRuleTable.rates[key=standard].ratePercent',
        problem: 'copy has 19, pack has 20',
      },
    ]);
    expect(() => assertPackCopy(pack, drifted, PAIRS)).toThrow(
      'The pack copy has drifted from its pack (1 mismatch):\n' +
        '  copy rates[key=standard].ratePercent ↔ pack taxRuleTable.rates[key=standard].ratePercent: copy has 19, pack has 20',
    );
  });

  it('compares deeply and names the first place inside the value where copy and pack differ', () => {
    const title = { copyPath: 'wordings.title', packPath: 'documentWordings.wordings.title' };
    const ladder = { copyPath: 'chaseLadder', packPath: 'chaseLadder' };
    const cases: [string, (value: ReturnType<typeof copy>) => void, PackCopyMismatch][] = [
      [
        'a number as a string',
        (c) => ((c.rates[1] as { ratePercent: unknown }).ratePercent = '10'),
        {
          copyPath: 'rates[key=reduced].ratePercent',
          packPath: 'taxRuleTable.rates[key=reduced].ratePercent',
          problem: 'copy has "10", pack has 10',
        },
      ],
      [
        'one changed byte deep inside',
        (c) => (c.wordings.title.fr = 'Travaux supplementaires'),
        { ...title, problem: 'at fr: copy has "Travaux supplementaires", pack has "Travaux supplémentaires"' },
      ],
      [
        'a missing nested key',
        (c) => delete (c.wordings.title as { en?: string }).en,
        { ...title, problem: 'at en: only the pack has this key' },
      ],
      [
        'an extra nested key',
        (c) => ((c.wordings.title as Record<string, string>).de = 'Zusatzarbeit'),
        { ...title, problem: 'at de: only the copy has this key' },
      ],
      [
        'reordered steps',
        (c) => c.chaseLadder.steps.reverse(),
        { ...ladder, problem: 'at steps[0].key: copy has "second", pack has "first"' },
      ],
      ['a dropped step', (c) => c.chaseLadder.steps.pop(), { ...ladder, problem: 'at steps: copy has 1 items, pack has 2' }],
      [
        'an extra step',
        (c) => c.chaseLadder.steps.push({ key: 'third', offsetDays: 30, active: true }),
        { ...ladder, problem: 'at steps: copy has 3 items, pack has 2' },
      ],
      [
        'null for an array',
        (c) => ((c.chaseLadder as unknown as { steps: unknown }).steps = null),
        { ...ladder, problem: expect.stringMatching(/^at steps: copy has null, pack has \[\{"key":"first",.*\.\.\.$/) },
      ],
    ];
    for (const [name, change, mismatch] of cases) {
      const drifted = copy();
      change(drifted);
      const mismatches = packCopyMismatches(pack, drifted, PAIRS);
      expect({ name, count: mismatches.length, first: mismatches[0] }).toEqual({ name, count: 1, first: mismatch });
    }
  });

  it('reports a path that is missing in the copy, in the pack, or in both', () => {
    const mismatches = packCopyMismatches(pack, copy(), {
      packName: 'packId',
      packId: 'taxRuleTable.name',
      'wordings.subtitle': 'documentWordings.wordings.subtitle',
      'packVersion.major': 'version',
    });
    expect(mismatches).toEqual([
      { copyPath: 'packName', packPath: 'packId', problem: 'copy: packName not found' },
      { copyPath: 'packId', packPath: 'taxRuleTable.name', problem: 'pack: taxRuleTable.name not found' },
      {
        copyPath: 'wordings.subtitle',
        packPath: 'documentWordings.wordings.subtitle',
        problem: 'copy: wordings.subtitle not found; pack: documentWordings.wordings.subtitle not found',
      },
      { copyPath: 'packVersion.major', packPath: 'version', problem: 'copy: packVersion.major not found' },
    ]);
  });

  it('fails a selector that matches no element, several elements, or no array', () => {
    const ambiguous = { rates: [{ key: 'standard' }, { key: 'standard' }], note: { key: 'standard' } };
    expect(
      packCopyMismatches(pack, ambiguous, {
        'rates[key=standard]': 'taxRuleTable.rates[key=standard]',
        'rates[key=super]': 'taxRuleTable.rates[key=super]',
        'note[key=standard]': 'taxRuleTable.rates[rate=standard]',
      }),
    ).toEqual([
      {
        copyPath: 'rates[key=standard]',
        packPath: 'taxRuleTable.rates[key=standard]',
        problem: 'copy: rates[key=standard] matches 2 elements, not 1',
      },
      {
        copyPath: 'rates[key=super]',
        packPath: 'taxRuleTable.rates[key=super]',
        problem: 'copy: rates[key=super] matches 0 elements, not 1; pack: taxRuleTable.rates[key=super] matches 0 elements, not 1',
      },
      {
        copyPath: 'note[key=standard]',
        packPath: 'taxRuleTable.rates[rate=standard]',
        problem: 'copy: note is not an array; pack: taxRuleTable.rates[rate=standard] matches 0 elements, not 1',
      },
    ]);
  });

  it('selects by the text of a number or boolean field, and allows dots in the value', () => {
    const versions = { releases: [{ tag: '1.4.0', notes: 'x' }] };
    expect(
      packCopyMismatches(pack, versions, {
        'releases[tag=1.4.0].tag': 'version',
      }),
    ).toEqual([]);
    expect(
      packCopyMismatches(pack, { first: 'first', second: 'second' }, {
        first: 'chaseLadder.steps[offsetDays=3].key',
        second: 'chaseLadder.steps[active=false].key',
      }),
    ).toEqual([]);
  });

  it('treats a malformed path as a mismatch, never as a pass', () => {
    for (const path of ['', '.packId', 'packId.', 'wordings..title', 'rates[key]', 'rates[key=standard', 'rates[=x]']) {
      expect(packCopyMismatches(pack, copy(), { [path]: 'packId' })).toEqual([
        { copyPath: path, packPath: 'packId', problem: `copy: "${path}" is not a valid path` },
      ]);
    }
  });

  it('lists every mismatch at once', () => {
    const drifted = copy();
    drifted.packVersion = '1.5.0';
    drifted.rates[1].ratePercent = 7;
    drifted.chaseLadder.status = 'draft';
    const failure = (() => {
      try {
        assertPackCopy(pack, drifted, PAIRS);
      } catch (error) {
        return (error as Error).message;
      }
      return 'no error';
    })();
    expect(failure.split('\n')).toEqual([
      'The pack copy has drifted from its pack (3 mismatches):',
      '  copy packVersion ↔ pack version: copy has "1.5.0", pack has "1.4.0"',
      '  copy rates[key=reduced].ratePercent ↔ pack taxRuleTable.rates[key=reduced].ratePercent: copy has 7, pack has 10',
      '  copy chaseLadder ↔ pack chaseLadder: at status: copy has "draft", pack has "complete"',
    ]);
  });

  it('refuses an empty pair list, which could never fail', () => {
    expect(() => packCopyMismatches(pack, copy(), {})).toThrow(TypeError);
    expect(() => assertPackCopy(pack, copy(), {})).toThrow(TypeError);
  });
});
