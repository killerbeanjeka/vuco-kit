// The `.vuco` 1.1 fields (vuco:walk Story 8.1): the I/O matrix's rows for a 1.0 bundle, a newer minor
// and bad 1.1 fields. Every 1.1 field is optional and checked wherever it appears, in any 1.x minor.
import {
  createVucoBundleFixture,
  createVucoSnagListSamples,
  validateVucoBundle,
  VUCO_BUNDLE_FORMAT_VERSION,
  VUCO_BUNDLE_LIMITS,
  VUCO_BUNDLE_PRIORITIES,
  VUCO_BUNDLE_STATUSES,
  type VucoBundleEntry,
  type VucoBundleValidation,
} from '../../src/vuco-file';

/** The English sample as loose JSON, the way a caller hands over a freshly parsed manifest.json. */
function looseSample() {
  const { manifest, entries } = createVucoSnagListSamples().firstWalk;
  return { manifest: manifest as unknown as Record<string, any>, entries };
}

function errorsOf(result: VucoBundleValidation): string[] {
  return result.ok ? [] : result.errors;
}

/** The errors for the sample with `change` applied to its loose manifest. */
function errorsAfter(change: (manifest: Record<string, any>) => void): string[] {
  const { manifest, entries } = looseSample();
  change(manifest);
  return errorsOf(validateVucoBundle(manifest, entries));
}

describe('compatibility', () => {
  it('still accepts the 1.0 fixture unchanged, and writers write 1.1', () => {
    const { manifest, entries } = createVucoBundleFixture();
    expect(manifest.formatVersion).toBe('1.0');
    expect(Object.keys(manifest)).toEqual(['format', 'formatVersion', 'producer', 'kind', 'createdAt', 'notes', 'attachments']);
    expect(validateVucoBundle(manifest, entries)).toEqual({ ok: true, manifest });
    expect(VUCO_BUNDLE_FORMAT_VERSION).toBe('1.1');
    expect(VUCO_BUNDLE_STATUSES).toEqual(['open', 'closed']);
    expect(VUCO_BUNDLE_PRIORITIES).toEqual(['high', 'medium', 'low']);
  });

  it('accepts a newer minor with fields and entries 1.1 does not know, beside the 1.1 fields', () => {
    const { manifest, entries } = looseSample();
    manifest.formatVersion = '1.7';
    manifest.site = { floor: 3 };
    manifest.producer.build = 42;
    manifest.notes[0].severity = 'major';
    manifest.notes[0].photoPairs[0].during = 'scaffold';
    manifest.attachments[0].takenAt = '2026-10-21T08:02:44Z';
    const archive: VucoBundleEntry[] = [
      { path: 'manifest.json', byteLength: 4096, sha256: '0'.repeat(64) },
      ...entries,
      { path: 'photos/extra.jpg', byteLength: 10, sha256: '1'.repeat(64) },
      { path: 'thumbnails/one.jpg', byteLength: 5, sha256: '2'.repeat(64) },
    ];
    expect(validateVucoBundle(manifest, archive)).toEqual({ ok: true, manifest });
  });

  it('checks a 1.1 field wherever it appears, in a 1.0 bundle too', () => {
    const { manifest, entries } = createVucoBundleFixture();
    const loose = manifest as unknown as Record<string, any>;
    loose.title = ' ';
    loose.notes[0].status = 'done';
    expect(errorsOf(validateVucoBundle(loose, entries))).toEqual([
      'title: must be a non-blank string, not " "',
      'note "note-1": status must be "open" or "closed", not "done"',
    ]);
  });
});

describe('the 1.1 manifest fields', () => {
  it('accepts RFC 9562 bundle ids of any version, and both language forms', () => {
    const accepted: [string, unknown][] = [
      ['bundleId', '01a15dd5-2602-7650-9f8e-0131f6dc3d41'],
      ['bundleId', '3f1c2b7a-9d4e-4a6b-b8c2-5e7f9a0d1c2e'],
      ['bundleId', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
      ['bundleId', '01a15dd5-2602-8650-af8e-0131f6dc3d41'],
      ['language', 'en'],
      ['language', 'de-AT'],
      ['title', 'A'],
      ['title', ' Flat 3 '],
    ];
    for (const [field, value] of accepted) {
      expect([field, value, errorsAfter((manifest) => (manifest[field] = value))]).toEqual([field, value, []]);
    }
  });

  it('rejects a bundle id that is not a lowercase RFC 9562 UUID', () => {
    const rejected: unknown[] = [
      '01A15DD5-2602-7650-9F8E-0131F6DC3D41',
      '01a15dd526027650 9f8e0131f6dc3d41',
      '01a15dd526027650-9f8e-0131f6dc3d41',
      '{01a15dd5-2602-7650-9f8e-0131f6dc3d41}',
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      '01a15dd5-2602-0650-9f8e-0131f6dc3d41',
      '01a15dd5-2602-9650-9f8e-0131f6dc3d41',
      '01a15dd5-2602-7650-cf8e-0131f6dc3d41',
      '01a15dd5-2602-7650-9f8e-0131f6dc3d4',
      '',
      7,
      null,
    ];
    for (const bundleId of rejected) {
      expect(errorsAfter((manifest) => (manifest.bundleId = bundleId))).toEqual([
        `bundleId: must be a lowercase RFC 9562 UUID (version 1 to 8, variant 10), not ${JSON.stringify(bundleId)}`,
      ]);
    }
  });

  it('rejects a blank title, or one that is not a string', () => {
    for (const title of ['', '   ', '\t\n', 7, null, ['Flat 3']]) {
      expect(errorsAfter((manifest) => (manifest.title = title))).toEqual([`title: must be a non-blank string, not ${JSON.stringify(title)}`]);
    }
  });

  it('rejects a language that is not xx or xx-YY', () => {
    for (const language of ['EN', 'eng', 'e', 'de_DE', 'de-de', 'de-DEU', 'DE-de', 'de-', '', 7, null]) {
      expect(errorsAfter((manifest) => (manifest.language = language))).toEqual([
        `language: must be a language code, "xx" or "xx-YY" such as "de" or "de-AT", not ${JSON.stringify(language)}`,
      ]);
    }
  });
});

describe('the 1.1 note fields', () => {
  it('accepts every status and priority, and due days that exist', () => {
    const values: [string, unknown][] = [
      ...VUCO_BUNDLE_STATUSES.map((status): [string, unknown] => ['status', status]),
      ...VUCO_BUNDLE_PRIORITIES.map((priority): [string, unknown] => ['priority', priority]),
      ['dueDate', '2024-02-29'],
      ['dueDate', '2000-02-29'],
      ['dueDate', '2026-12-31'],
      ['dueDate', '2026-01-01'],
      ['trade', 'Electrical'],
      ['location', ['Flat 3']],
    ];
    for (const [field, value] of values) {
      expect([field, value, errorsAfter((manifest) => (manifest.notes[2][field] = value))]).toEqual([field, value, []]);
    }
  });

  it('rejects a status, a priority or a due date outside its rule', () => {
    const note = 'note "01a15d85-479c-7b7d-a04d-ab8aedebecab"';
    const cases: [string, unknown, string][] = [
      ['status', 'done', `${note}: status must be "open" or "closed", not "done"`],
      ['status', 'Open', `${note}: status must be "open" or "closed", not "Open"`],
      ['status', null, `${note}: status must be "open" or "closed", not null`],
      ['priority', 'urgent', `${note}: priority must be "high", "medium" or "low", not "urgent"`],
      ['priority', 'HIGH', `${note}: priority must be "high", "medium" or "low", not "HIGH"`],
      ['priority', 1, `${note}: priority must be "high", "medium" or "low", not 1`],
      ['priority', null, `${note}: priority must be "high", "medium" or "low", not null`],
      ['dueDate', '2026-02-30', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-02-30"`],
      ['dueDate', '2025-02-29', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2025-02-29"`],
      ['dueDate', '1900-02-29', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "1900-02-29"`],
      ['dueDate', '2026-04-31', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-04-31"`],
      ['dueDate', '2026-13-01', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-13-01"`],
      ['dueDate', '2026-00-10', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-00-10"`],
      ['dueDate', '2026-1-5', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-1-5"`],
      ['dueDate', '2026-10-21T00:00:00Z', `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-10-21T00:00:00Z"`],
      ['dueDate', 20261021, `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not 20261021`],
      ['dueDate', null, `${note}: dueDate must be a day that exists, as YYYY-MM-DD, not null`],
    ];
    for (const [field, value, error] of cases) {
      expect(errorsAfter((manifest) => (manifest.notes[2][field] = value))).toEqual([error]);
    }
  });

  it('rejects a location that is empty or not a list, a blank location name, and a blank trade', () => {
    const note = 'note "01a15d85-479c-7b7d-a04d-ab8aedebecab"';
    const cases: [string, unknown, string[]][] = [
      ['location', [], [`${note}: location must be an array of at least one location name, not []`]],
      ['location', 'Flat 3', [`${note}: location must be an array of at least one location name, not "Flat 3"`]],
      ['location', null, [`${note}: location must be an array of at least one location name, not null`]],
      ['location', [''], [`${note}: location[0] must be a non-blank string, not ""`]],
      [
        'location',
        ['Flat 3', ' ', 7],
        [`${note}: location[1] must be a non-blank string, not " "`, `${note}: location[2] must be a non-blank string, not 7`],
      ],
      ['trade', '', [`${note}: trade must be a non-blank string, not ""`]],
      ['trade', '  ', [`${note}: trade must be a non-blank string, not "  "`]],
      ['trade', ['Tiling'], [`${note}: trade must be a non-blank string, not ["Tiling"]`]],
      ['trade', null, [`${note}: trade must be a non-blank string, not null`]],
    ];
    for (const [field, value, errors] of cases) {
      expect(errorsAfter((manifest) => (manifest.notes[2][field] = value))).toEqual(errors);
    }
  });

  it('rejects a pair with no photo, a pair id outside the note’s attachmentIds, and an id used twice', () => {
    const note = 'note "01a15d7f-e659-7498-914e-9c758a9bd797"';
    const { manifest } = looseSample();
    const [left, right] = manifest.notes[1].attachmentIds as string[];
    const elsewhere = manifest.notes[0].attachmentIds[0] as string;
    const leftOut = (id: string) => `${note}: photoPairs leaves out "${id}", one of the note's attachmentIds`;
    const noSide = (index: number) => `${note}: photoPairs[${index}] must be an object with a before photo, an after photo or both`;
    const cases: [unknown, string[]][] = [
      [[{}], [noSide(0), leftOut(left), leftOut(right)]],
      [[null, left], [noSide(0), noSide(1), leftOut(left), leftOut(right)]],
      [[{ before: 7 }], [`${note}: photoPairs[0].before must be an attachment id, not 7`, leftOut(left), leftOut(right)]],
      [[{ before: left, after: null }], [`${note}: photoPairs[0].after must be an attachment id, not null`, leftOut(right)]],
      [[{ before: elsewhere }], [`${note}: photoPairs[0].before "${elsewhere}" is not one of the note's attachmentIds`, leftOut(left), leftOut(right)]],
      [[{ after: 'photo-9' }], [`${note}: photoPairs[0].after "photo-9" is not one of the note's attachmentIds`, leftOut(left), leftOut(right)]],
      [[{ before: left, after: left }], [`${note}: photoPairs[0].after "${left}" appears earlier in photoPairs`, leftOut(right)]],
      [
        [{ before: left }, { before: right }, { after: right }],
        [`${note}: photoPairs[2].after follows a row with no after photo`, `${note}: photoPairs[2].after "${right}" appears earlier in photoPairs`],
      ],
      [{ before: left }, [`${note}: photoPairs must be an array of photo pairs`]],
      [null, [`${note}: photoPairs must be an array of photo pairs`]],
      [[{ after: right }, { after: left }], []],
      [[{ before: left, after: right }], []],
    ];
    for (const [photoPairs, errors] of cases) {
      expect([photoPairs, errorsAfter((loose) => (loose.notes[1].photoPairs = photoPairs))]).toEqual([photoPairs, errors]);
    }
  });

  it('requires at least one pair, every one of the note’s photos in exactly one pair, and columns without gaps', () => {
    const note = 'note "01a15d7f-e659-7498-914e-9c758a9bd797"';
    const { manifest } = looseSample();
    const [left, right] = manifest.notes[1].attachmentIds as string[];
    const cases: [unknown, string[]][] = [
      // At least one pair.
      [[], [`${note}: photoPairs must hold at least one pair`]],
      // Every photo of the note in a pair.
      [[{ before: left }], [`${note}: photoPairs leaves out "${right}", one of the note's attachmentIds`]],
      // Each column filled from the first row: a before photo after a row without one is a gap.
      [[{ after: left }, { before: right }], [`${note}: photoPairs[1].before follows a row with no before photo`]],
      [[{ before: left, after: right }], []],
    ];
    for (const [photoPairs, errors] of cases) {
      expect([photoPairs, errorsAfter((loose) => (loose.notes[1].photoPairs = photoPairs))]).toEqual([photoPairs, errors]);
    }
  });

  it('takes pair ids from the note’s own attachmentIds, which a note without photos does not have', () => {
    const errors = errorsAfter((manifest) => {
      manifest.notes[2].photoPairs = [{ before: manifest.attachments[0].id }];
    });
    expect(errors).toEqual([
      `note "01a15d85-479c-7b7d-a04d-ab8aedebecab": photoPairs[0].before "${looseSample().manifest.attachments[0].id}" is not one of the note's attachmentIds`,
    ]);
  });

  it('lists one line per problem, each naming its note or manifest field', () => {
    const errors = errorsAfter((manifest) => {
      manifest.bundleId = manifest.bundleId.toUpperCase();
      manifest.notes[0].status = 'done';
      manifest.notes[0].dueDate = '2026-02-30';
      manifest.notes[1].location = [];
      manifest.notes[1].trade = '  ';
      manifest.notes[1].photoPairs = [{}, { before: manifest.notes[0].attachmentIds[0] }, { before: manifest.notes[1].attachmentIds[0] }, { after: manifest.notes[1].attachmentIds[0] }];
    });
    const first = 'note "01a15d7b-b6a7-7b2c-92f0-ab9c25490e4f"';
    const second = 'note "01a15d7f-e659-7498-914e-9c758a9bd797"';
    const { manifest } = looseSample();
    expect(errors).toEqual([
      'bundleId: must be a lowercase RFC 9562 UUID (version 1 to 8, variant 10), not "01A15DD5-2602-7650-9F8E-0131F6DC3D41"',
      `${first}: status must be "open" or "closed", not "done"`,
      `${first}: dueDate must be a day that exists, as YYYY-MM-DD, not "2026-02-30"`,
      `${second}: location must be an array of at least one location name, not []`,
      `${second}: trade must be a non-blank string, not "  "`,
      `${second}: photoPairs[0] must be an object with a before photo, an after photo or both`,
      `${second}: photoPairs[1].before "${manifest.notes[0].attachmentIds[0]}" is not one of the note's attachmentIds`,
      `${second}: photoPairs[3].after follows a row with no after photo`,
      `${second}: photoPairs[3].after "${manifest.notes[1].attachmentIds[0]}" appears earlier in photoPairs`,
      `${second}: photoPairs leaves out "${manifest.notes[1].attachmentIds[1]}", one of the note's attachmentIds`,
    ]);
  });
});

describe('bounded problem lines', () => {
  it('echoes a value too deep for JSON without throwing, and a circular one as […]', () => {
    let deep: unknown = [];
    for (let level = 0; level < 5_000; level += 1) deep = [deep];
    const deepErrors = errorsAfter((manifest) => (manifest.title = deep));
    expect(deepErrors).toHaveLength(1);
    expect(deepErrors[0].startsWith('title: must be a non-blank string, not ')).toBe(true);
    expect(deepErrors[0].length).toBeLessThanOrEqual('title: must be a non-blank string, not '.length + 80);
    const circular: unknown[] = [];
    circular.push(circular);
    expect(errorsAfter((manifest) => (manifest.title = circular))).toEqual(['title: must be a non-blank string, not […]']);
  });

  it('cuts a long value to 80 characters', () => {
    const note = 'note "01a15d85-479c-7b7d-a04d-ab8aedebecab"';
    const errors = errorsAfter((manifest) => (manifest.notes[2].status = 'x'.repeat(10_000_000)));
    // The JSON of the first 80 characters, cut to 79 and "…": the closing quote goes with the cut.
    expect(errors).toEqual([`${note}: status must be "open" or "closed", not "${'x'.repeat(78)}…`]);
  });

  it('quotes an id, so a quote or a line break in it cannot make a line of its own', () => {
    const id = 'a"b' + String.fromCharCode(10) + 'c';
    const errors = errorsAfter((manifest) => {
      manifest.notes[2].id = id;
      manifest.notes[2].status = 'done';
    });
    expect(errors).toEqual([`note ${JSON.stringify(id)}: status must be "open" or "closed", not "done"`]);
    expect(errors[0]).not.toContain(String.fromCharCode(10));
  });

  it('shows NaN and Infinity as themselves, not as null', () => {
    const errors = errorsAfter((manifest) => {
      manifest.attachments[0].byteLength = NaN;
      manifest.attachments[1].byteLength = Infinity;
    });
    const [first, second] = looseSample().manifest.attachments;
    expect(errors).toEqual([
      `attachment "${first.id}": byteLength must be a positive integer, not NaN`,
      `attachment "${second.id}": byteLength must be a positive integer, not Infinity`,
    ]);
  });
});

describe('the constants the validator reads', () => {
  it('are frozen', () => {
    for (const constant of [VUCO_BUNDLE_LIMITS, VUCO_BUNDLE_STATUSES, VUCO_BUNDLE_PRIORITIES]) {
      expect(Object.isFrozen(constant)).toBe(true);
    }
    expect(() => (VUCO_BUNDLE_STATUSES as unknown as string[]).push('done')).toThrow(TypeError);
    expect(Reflect.set(VUCO_BUNDLE_LIMITS, 'notes', 1)).toBe(false);
    expect(VUCO_BUNDLE_LIMITS.notes).toBe(10_000);
  });
});
