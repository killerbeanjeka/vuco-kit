// The `.vuco` limits (vuco:walk Story 8.1): every limit in VUCO_BUNDLE_LIMITS at its value and one over,
// on 1.x bundles of any minor, and a bundle at all the count limits at once within Jest's default timeout.
import {
  createVucoBundleFixture,
  createVucoSnagListSamples,
  validateVucoBundle,
  VUCO_BUNDLE_LIMITS,
  type VucoBundleEntry,
  type VucoBundleValidation,
} from '../../src/vuco-file';

const MIB = 1024 * 1024;
const DIGEST = 'a'.repeat(64);
// U+1F6BF (shower), outside the Basic Multilingual Plane: one code point, two UTF-16 units.
const ASTRAL = String.fromCodePoint(0x1f6bf);

function errorsOf(result: VucoBundleValidation): string[] {
  return result.ok ? [] : result.errors;
}

/** The English sample as loose JSON. */
function looseSample() {
  const { manifest, entries } = createVucoSnagListSamples().firstWalk;
  return { manifest: manifest as unknown as Record<string, any>, entries };
}

/** A minimal 1.1 manifest with `notes` notes and one attachment of each given size, and its entries. */
function bundleOf(noteCount: number, sizes: readonly number[]) {
  const attachments = sizes.map((byteLength, index) => ({
    id: `photo-${index}`,
    path: `photos/photo-${index}.jpg`,
    mediaType: 'image/jpeg',
    byteLength,
    sha256: DIGEST,
  }));
  const manifest = {
    format: 'vuco-bundle',
    formatVersion: '1.1',
    producer: { app: 'vuco:walk', version: '0.6.6.1' },
    kind: 'snag-list',
    createdAt: '2026-10-21T09:40:12Z',
    notes: Array.from({ length: noteCount }, (_, index) => ({ id: `note-${index}`, text: '' })),
    attachments,
  };
  const entries: VucoBundleEntry[] = attachments.map(({ path, byteLength }) => ({ path, byteLength, sha256: DIGEST }));
  return { manifest, entries };
}

/** `count` entries that no attachment names. */
function extraEntries(count: number): VucoBundleEntry[] {
  return Array.from({ length: count }, (_, index) => ({ path: `extra/${index}.bin`, byteLength: 1, sha256: '' }));
}

describe('VUCO_BUNDLE_LIMITS', () => {
  it('pins every limit', () => {
    expect(VUCO_BUNDLE_LIMITS).toEqual({
      notes: 10_000,
      attachments: 20_000,
      entries: 25_000,
      attachmentBytes: 32 * MIB,
      totalAttachmentBytes: 2_000_000_000,
      manifestBytes: 16 * MIB,
      noteTextChars: 20_000,
      nameChars: 500,
      locationLevels: 10,
    });
  });
});

describe('each limit at its value and one over', () => {
  it('notes', () => {
    const atLimit = bundleOf(10_000, [1]);
    expect(validateVucoBundle(atLimit.manifest, atLimit.entries).ok).toBe(true);
    const over = bundleOf(10_001, [1]);
    expect(errorsOf(validateVucoBundle(over.manifest, over.entries))).toEqual(['notes: 10001 notes, over the limit of 10000']);
  });

  it('attachments', () => {
    const atLimit = bundleOf(1, new Array<number>(20_000).fill(1));
    expect(validateVucoBundle(atLimit.manifest, atLimit.entries).ok).toBe(true);
    const over = bundleOf(1, new Array<number>(20_001).fill(1));
    expect(errorsOf(validateVucoBundle(over.manifest, over.entries))).toEqual(['attachments: 20001 attachments, over the limit of 20000']);
  });

  it('archive entries, counting manifest.json and entries no attachment names', () => {
    const { manifest, entries } = looseSample();
    const manifestEntry = { path: 'manifest.json', byteLength: 4096, sha256: '' };
    const atLimit = [manifestEntry, ...entries, ...extraEntries(25_000 - 1 - entries.length)];
    expect(atLimit).toHaveLength(25_000);
    expect(validateVucoBundle(manifest, atLimit).ok).toBe(true);
    expect(errorsOf(validateVucoBundle(manifest, [...atLimit, ...extraEntries(1)]))).toEqual([
      'entries: 25001 archive entries, over the limit of 25000',
    ]);
  });

  it('one attachment’s bytes', () => {
    const atLimit = bundleOf(1, [32 * MIB]);
    expect(validateVucoBundle(atLimit.manifest, atLimit.entries).ok).toBe(true);
    const over = bundleOf(1, [32 * MIB + 1]);
    expect(errorsOf(validateVucoBundle(over.manifest, over.entries))).toEqual([
      'attachment "photo-0": byteLength is 33554433, over the limit of 33554432',
    ]);
  });

  it('all attachments’ bytes together', () => {
    // 59 attachments of 32 MiB and one of the rest: 2,000,000,000 bytes, each attachment within its own limit.
    const sizes = [...new Array<number>(59).fill(32 * MIB), 2_000_000_000 - 59 * 32 * MIB];
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(2_000_000_000);
    const atLimit = bundleOf(1, sizes);
    expect(validateVucoBundle(atLimit.manifest, atLimit.entries).ok).toBe(true);
    const over = bundleOf(1, [...sizes.slice(0, -1), sizes[59] + 1]);
    expect(errorsOf(validateVucoBundle(over.manifest, over.entries))).toEqual([
      'attachments: 2000000001 bytes in all, over the limit of 2000000000',
    ]);
  });

  it('manifest.json’s bytes, when the entries list it', () => {
    const { manifest, entries } = looseSample();
    const withManifest = (byteLength: unknown) => [{ path: 'manifest.json', byteLength, sha256: '' } as VucoBundleEntry, ...entries];
    expect(validateVucoBundle(manifest, withManifest(16 * MIB)).ok).toBe(true);
    expect(errorsOf(validateVucoBundle(manifest, withManifest(16 * MIB + 1)))).toEqual([
      'manifest.json: 16777217 bytes in the archive, over the limit of 16777216',
    ]);
    for (const byteLength of ['16 MiB', -1, 1.5]) {
      expect(errorsOf(validateVucoBundle(manifest, withManifest(byteLength)))).toEqual([
        `manifest.json: byteLength in the archive must be a whole number of bytes, not ${JSON.stringify(byteLength)}`,
      ]);
    }
    // Not listed: nothing to check.
    expect(validateVucoBundle(manifest, entries).ok).toBe(true);
  });

  it('manifest.json listed twice, within its limit or not', () => {
    const { manifest, entries } = looseSample();
    const listing = (byteLength: number) => ({ path: 'manifest.json', byteLength, sha256: '' });
    expect(errorsOf(validateVucoBundle(manifest, [listing(4096), listing(4096), ...entries]))).toEqual([
      'manifest.json appears 2 times in the archive',
    ]);
    expect(errorsOf(validateVucoBundle(manifest, [listing(4096), listing(16 * MIB + 1), ...entries]))).toEqual([
      'manifest.json appears 2 times in the archive',
      'manifest.json: 16777217 bytes in the archive, over the limit of 16777216',
    ]);
  });

  it('note text, in code points, and an empty text', () => {
    const name = 'note "01a15d85-479c-7b7d-a04d-ab8aedebecab"';
    const verdicts = [
      ['a'.repeat(20_000), []],
      ['a'.repeat(20_001), [`${name}: text is 20001 characters long, over the limit of 20000`]],
      [ASTRAL.repeat(20_000), []],
      [ASTRAL.repeat(20_001), [`${name}: text is 20001 characters long, over the limit of 20000`]],
      ['', []],
    ].map(([text, errors]) => {
      const { manifest, entries } = looseSample();
      manifest.notes[2].text = text;
      return [errorsOf(validateVucoBundle(manifest, entries)), errors];
    });
    for (const [found, expected] of verdicts) expect(found).toEqual(expected);
  });

  it('the title, a trade and a location name, in code points', () => {
    const name = 'note "01a15d85-479c-7b7d-a04d-ab8aedebecab"';
    const fields: [string, (manifest: Record<string, any>, value: string) => void][] = [
      ['title:', (manifest, value) => (manifest.title = value)],
      [`${name}: trade`, (manifest, value) => (manifest.notes[2].trade = value)],
      [`${name}: location[1]`, (manifest, value) => (manifest.notes[2].location = ['Flat 3', value])],
    ];
    for (const [field, set] of fields) {
      for (const [value, errors] of [
        ['b'.repeat(500), []],
        [ASTRAL.repeat(500), []],
        ['b'.repeat(501), [`${field} is 501 characters long, over the limit of 500`]],
        [`${ASTRAL.repeat(499)}bc`, [`${field} is 501 characters long, over the limit of 500`]],
      ] as const) {
        const { manifest, entries } = looseSample();
        set(manifest, value);
        expect([field, value.length, errorsOf(validateVucoBundle(manifest, entries))]).toEqual([field, value.length, errors]);
      }
    }
  });

  it('location levels', () => {
    const name = 'note "01a15d85-479c-7b7d-a04d-ab8aedebecab"';
    const levels = (count: number) => Array.from({ length: count }, (_, index) => `Level ${index + 1}`);
    const atLimit = looseSample();
    atLimit.manifest.notes[2].location = levels(10);
    expect(validateVucoBundle(atLimit.manifest, atLimit.entries).ok).toBe(true);
    const over = looseSample();
    over.manifest.notes[2].location = levels(11);
    expect(errorsOf(validateVucoBundle(over.manifest, over.entries))).toEqual([`${name}: location has 11 levels, over the limit of 10`]);
  });

  it('hold for every 1.x bundle, 1.0 included', () => {
    const { manifest, entries } = createVucoBundleFixture();
    const loose = manifest as unknown as Record<string, any>;
    loose.notes[0].text = 'c'.repeat(20_001);
    expect(errorsOf(validateVucoBundle(loose, [{ path: 'manifest.json', byteLength: 16 * MIB + 1, sha256: '' }, ...entries]))).toEqual([
      'manifest.json: 16777217 bytes in the archive, over the limit of 16777216',
      'note "note-1": text is 20001 characters long, over the limit of 20000',
    ]);
  });
});

describe('a bundle at every count limit at once', () => {
  it('validates within the default timeout, its entries indexed once', () => {
    const { manifest, entries } = bundleOf(10_000, new Array<number>(20_000).fill(1));
    manifest.notes.forEach((note, index) => {
      Object.assign(note, { attachmentIds: [`photo-${2 * index}`, `photo-${2 * index + 1}`] });
    });
    const archive = [{ path: 'manifest.json', byteLength: 16 * MIB, sha256: '' }, ...entries, ...extraEntries(4_999)];
    expect(archive).toHaveLength(25_000);
    const started = Date.now();
    expect(validateVucoBundle(manifest, archive).ok).toBe(true);
    // About 40 ms here; scanning the entries once per attachment instead took 2.5 s.
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('a bounded problem list', () => {
  it('stops at the header and count lines once a count is over its limit', () => {
    // 5,000,000 empty notes: one count line, not a line for each note.
    const notes = bundleOf(1, [1]);
    (notes.manifest as Record<string, unknown>).kind = 'Snag List';
    (notes.manifest as Record<string, unknown>).notes = new Array(5_000_000).fill({});
    expect(errorsOf(validateVucoBundle(notes.manifest, notes.entries))).toEqual([
      'kind: must be a lowercase kebab-case name such as "snag-list", not "Snag List"',
      'notes: 5000000 notes, over the limit of 10000',
    ]);
    const attachments = bundleOf(1, [1]);
    (attachments.manifest as Record<string, unknown>).attachments = new Array(20_001).fill({});
    expect(errorsOf(validateVucoBundle(attachments.manifest, attachments.entries))).toEqual([
      'attachments: 20001 attachments, over the limit of 20000',
    ]);
    // Over the entry limit, an attachment missing from the archive is not looked for.
    const entries = bundleOf(1, [1]);
    expect(errorsOf(validateVucoBundle(entries.manifest, extraEntries(25_001)))).toEqual([
      'entries: 25001 archive entries, over the limit of 25000',
    ]);
  });

  it('reports only the level count past the location limit', () => {
    const { manifest, entries } = looseSample();
    manifest.notes[2].location = new Array(1_000_000).fill(' ');
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'note "01a15d85-479c-7b7d-a04d-ab8aedebecab": location has 1000000 levels, over the limit of 10',
    ]);
  });

  it('keeps 100 lines, then one line counting the rest', () => {
    const notTexts = (count: number) => {
      const { manifest, entries } = bundleOf(count, [1]);
      manifest.notes.forEach((note) => Object.assign(note, { text: 7 }));
      return errorsOf(validateVucoBundle(manifest, entries));
    };
    const line = (index: number) => `note "note-${index}": text must be a string`;
    expect(notTexts(100)).toEqual(Array.from({ length: 100 }, (_, index) => line(index)));
    expect(notTexts(101)).toEqual([...Array.from({ length: 100 }, (_, index) => line(index)), '… and 1 more problem']);
    const many = notTexts(10_000);
    expect(many).toHaveLength(101);
    expect(many[100]).toBe('… and 9900 more problems');
  });
});
