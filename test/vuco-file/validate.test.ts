/// <reference types="node" />
// The `.vuco` rows of the Story 15.3 I/O matrix (bundle version, bundle attachments), the field rules
// in src/vuco-file/README.md, and proof that the fixture digests are the real SHA-256 of its bytes.
import { createHash } from 'node:crypto';

import {
  createVucoBundleFixture,
  SUPPORTED_FORMAT_MAJOR,
  validateVucoBundle,
  VUCO_BUNDLE_MANIFEST_PATH,
  VUCO_BUNDLE_PHOTO_TYPES,
  VUCO_BUNDLE_PHOTOS_DIR,
  VUCO_BUNDLE_PRODUCER_APP,
  type VucoBundleEntry,
  type VucoBundleValidation,
} from '../../src/vuco-file';

/** The fixture as loose JSON, the way a caller hands over a freshly parsed manifest.json. */
function looseFixture() {
  const { manifest, entries } = createVucoBundleFixture();
  return { manifest: manifest as unknown as Record<string, any>, entries };
}

function errorsOf(result: VucoBundleValidation): string[] {
  return result.ok ? [] : result.errors;
}

describe('the fixture', () => {
  it('is a valid bundle, and the validator hands back its manifest', () => {
    const { manifest, entries } = createVucoBundleFixture();
    expect(validateVucoBundle(manifest, entries)).toEqual({ ok: true, manifest });
  });

  it('carries the real SHA-256 and size of each photo, and the photos are PNG files', () => {
    const { manifest, entries, photos } = createVucoBundleFixture();
    expect(photos).toHaveLength(2);
    photos.forEach((photo, index) => {
      expect(createHash('sha256').update(photo.bytes).digest('hex')).toBe(photo.sha256);
      expect(Array.from(photo.bytes.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(manifest.attachments[index]).toMatchObject({
        path: photo.path,
        mediaType: 'image/png',
        byteLength: photo.bytes.length,
        sha256: photo.sha256,
      });
      expect(entries[index]).toEqual({ path: photo.path, byteLength: photo.bytes.length, sha256: photo.sha256 });
    });
    expect(photos[0].sha256).not.toBe(photos[1].sha256);
  });

  it('is fresh on every call', () => {
    const first = createVucoBundleFixture();
    first.manifest.notes.length = 0;
    first.photos[0].bytes[0] = 0;
    const second = createVucoBundleFixture();
    expect(second.manifest.notes).toHaveLength(3);
    expect(second.photos[0].bytes[0]).toBe(0x89);
  });

  it('pins the layout constants', () => {
    expect(SUPPORTED_FORMAT_MAJOR).toBe(1);
    expect(VUCO_BUNDLE_MANIFEST_PATH).toBe('manifest.json');
    expect(VUCO_BUNDLE_PHOTOS_DIR).toBe('photos/');
    expect(VUCO_BUNDLE_PHOTO_TYPES).toEqual({
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'image/webp': ['.webp'],
    });
    expect(VUCO_BUNDLE_PRODUCER_APP.source).toBe('^vuco(?::[a-z][a-z0-9-]*)?$');
  });
});

describe('format versions', () => {
  it('rejects major version 2 and names it, without reading the rest', () => {
    const { manifest, entries } = looseFixture();
    manifest.formatVersion = '2.0';
    manifest.notes = 'not even an array';
    expect(validateVucoBundle(manifest, entries)).toEqual({
      ok: false,
      errors: ['formatVersion 2.0: major version 2 is not supported; this reader reads 1.x'],
    });
  });

  it('accepts 1.7 with unknown fields and extra archive entries', () => {
    const { manifest, entries } = looseFixture();
    manifest.formatVersion = '1.7';
    manifest.language = 'de';
    manifest.producer.build = 42;
    manifest.notes[0].priority = 'high';
    manifest.attachments[0].takenAt = '2026-09-16T08:00:00Z';
    const archive: VucoBundleEntry[] = [
      { path: 'manifest.json', byteLength: 612, sha256: '0'.repeat(64) },
      ...entries,
      { path: 'photos/extra.png', byteLength: 10, sha256: '1'.repeat(64) },
      { path: 'thumbnails/snag-1.png', byteLength: 5, sha256: '2'.repeat(64) },
    ];
    expect(validateVucoBundle(manifest, archive)).toEqual({ ok: true, manifest });
  });

  it('rejects another format, and a version that is not MAJOR.MINOR', () => {
    const cases: [unknown, unknown, string][] = [
      ['vuco-bundl', '1.0', 'format: must be "vuco-bundle", not "vuco-bundl"'],
      [undefined, '1.0', 'format: must be "vuco-bundle", not undefined'],
      ['vuco-bundle', '1', 'formatVersion: must be "MAJOR.MINOR", not "1"'],
      ['vuco-bundle', '1.0.0', 'formatVersion: must be "MAJOR.MINOR", not "1.0.0"'],
      ['vuco-bundle', 'v1.0', 'formatVersion: must be "MAJOR.MINOR", not "v1.0"'],
      ['vuco-bundle', '01.0', 'formatVersion: must be "MAJOR.MINOR", not "01.0"'],
      ['vuco-bundle', 1.0, 'formatVersion: must be "MAJOR.MINOR", not 1'],
      ['vuco-bundle', '0.9', 'formatVersion 0.9: major version 0 is not supported; this reader reads 1.x'],
    ];
    for (const [format, formatVersion, error] of cases) {
      const { manifest, entries } = looseFixture();
      manifest.format = format;
      manifest.formatVersion = formatVersion;
      expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([error]);
    }
  });

  it('rejects a manifest that is not an object, and entries that are not a list', () => {
    for (const manifest of [null, [], 'manifest', 1]) {
      expect(validateVucoBundle(manifest, [])).toEqual({ ok: false, errors: ['manifest: must be a JSON object'] });
    }
    const { manifest } = createVucoBundleFixture();
    const notAList = { path: 'photos/snag-1.png' } as unknown as VucoBundleEntry[];
    expect(errorsOf(validateVucoBundle(manifest, notAList))).toEqual([
      'entries: must be an array of archive entries',
      'attachment "photo-1": photos/snag-1.png is missing from the archive',
      'attachment "photo-2": photos/snag-2.png is missing from the archive',
    ]);
  });
});

describe('attachments and notes', () => {
  it('rejects an attachment the archive does not hold', () => {
    const { manifest, entries } = createVucoBundleFixture();
    expect(errorsOf(validateVucoBundle(manifest, entries.slice(1)))).toEqual([
      'attachment "photo-1": photos/snag-1.png is missing from the archive',
    ]);
  });

  it('rejects an attachment whose size or digest differs from the archive, or that the archive holds twice', () => {
    const { manifest, entries } = createVucoBundleFixture();
    const archive = [{ ...entries[0], byteLength: 68, sha256: 'f'.repeat(64) }, entries[1], entries[1]];
    expect(errorsOf(validateVucoBundle(manifest, archive))).toEqual([
      'attachment "photo-1": byteLength is 67 in the manifest but 68 in the archive',
      'attachment "photo-1": sha256 in the manifest does not match photos/snag-1.png in the archive',
      'attachment "photo-2": photos/snag-2.png appears 2 times in the archive',
    ]);
  });

  it('rejects an archive entry whose size or digest is missing or malformed', () => {
    const { manifest, entries } = createVucoBundleFixture();
    const archive = [{ path: entries[0].path }, { ...entries[1], sha256: entries[1].sha256.toUpperCase() }];
    expect(errorsOf(validateVucoBundle(manifest, archive as VucoBundleEntry[]))).toEqual([
      'attachment "photo-1": byteLength is 67 in the manifest but undefined in the archive',
      'attachment "photo-1": sha256 in the manifest does not match photos/snag-1.png in the archive',
      'attachment "photo-2": sha256 in the manifest does not match photos/snag-2.png in the archive',
    ]);
  });

  it('rejects a note that names an unknown attachment', () => {
    const { manifest, entries } = looseFixture();
    manifest.notes[1].attachmentIds = ['photo-2', 'photo-9', 7];
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'note "note-2": attachmentIds names unknown attachment "photo-9"',
      'note "note-2": attachmentIds names unknown attachment 7',
    ]);
  });

  it('rejects duplicate note ids, attachment ids and attachment paths', () => {
    const { manifest, entries } = looseFixture();
    manifest.notes[2].id = 'note-1';
    // photo-1 again, as a third file the archive does hold; then photo-4 pointing at photo-1's file.
    manifest.attachments.push({ ...manifest.attachments[1], id: 'photo-1', path: 'photos/snag-3.png' });
    manifest.attachments.push({ ...manifest.attachments[0], id: 'photo-4' });
    const archive = [...entries, { ...entries[1], path: 'photos/snag-3.png' }];
    expect(errorsOf(validateVucoBundle(manifest, archive))).toEqual([
      'attachment "photo-1": duplicate id',
      'attachment "photo-4": duplicate path "photos/snag-1.png"',
      'note "note-1": duplicate id',
    ]);
  });

  it('rejects an attachment path outside photos/', () => {
    const paths = [
      'manifest.json',
      'photo/snag-1.png',
      '/photos/snag-1.png',
      'photos/',
      'photos/../manifest.json',
      'photos/sub/snag-1.png',
      'photos/.hidden.png',
      'photos\\snag-1.png',
      'Photos/snag-1.png',
      42,
    ];
    for (const path of paths) {
      const { manifest, entries } = looseFixture();
      manifest.attachments[0].path = path;
      expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
        `attachment "photo-1": path ${JSON.stringify(path)} must name a file directly under photos/`,
      ]);
    }
  });

  it('names the field of every malformed value, and lists all problems at once', () => {
    const { manifest, entries } = looseFixture();
    manifest.producer = { app: 'walk', version: '' };
    manifest.kind = 'Snag List';
    manifest.createdAt = '2026-09-16T08:30';
    manifest.attachments[0] = { id: '', path: 'photos/snag-1.png', mediaType: 'application/pdf', byteLength: 0, sha256: 'ABC' };
    manifest.attachments[1].byteLength = 1.5;
    manifest.notes[0] = { id: 'note-1', text: 7, attachmentIds: 'photo-1' };
    manifest.notes.push('a note');
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'producer.app: must be "vuco" or "vuco:<name>" (a lowercase letter, then lowercase letters, digits and "-"), not "walk"',
      'producer.version: must be a MAJOR.EPIC.STORY.BUILD version name such as "0.2.0.1", not ""',
      'kind: must be a lowercase kebab-case name such as "snag-list", not "Snag List"',
      'createdAt: must be an ISO 8601 date-time with seconds and a time zone, not "2026-09-16T08:30"',
      'attachments[0]: id must be a non-empty string',
      'attachments[0]: mediaType "application/pdf" must be one of image/jpeg, image/png, image/heic, image/webp',
      'attachments[0]: byteLength must be a positive integer, not 0',
      'attachments[0]: sha256 must be 64 lowercase hex digits',
      'attachment "photo-2": byteLength must be a positive integer, not 1.5',
      'note "note-1": text must be a string',
      'note "note-1": attachmentIds must be an array of attachment ids',
      'notes[3]: must be an object',
    ]);
  });

  it('checks createdAt, producer and the lists themselves', () => {
    const invalidTimes = ['2026-09-16', '2026-09-16T08:30:00', '2026-13-01T08:30:00Z', '16.09.2026 08:30', 20260916];
    for (const createdAt of invalidTimes) {
      const { manifest, entries } = looseFixture();
      manifest.createdAt = createdAt;
      expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
        `createdAt: must be an ISO 8601 date-time with seconds and a time zone, not ${JSON.stringify(createdAt)}`,
      ]);
    }
    for (const createdAt of ['2026-09-16T08:30:00.123Z', '2026-09-16T10:30:00+02:00']) {
      const { manifest, entries } = looseFixture();
      manifest.createdAt = createdAt;
      expect(validateVucoBundle(manifest, entries).ok).toBe(true);
    }
    const { manifest, entries } = looseFixture();
    manifest.producer = 'vuco';
    manifest.notes = {};
    manifest.attachments = null;
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'producer: must be an object with app and version',
      'attachments: must be an array',
      'notes: must be an array',
    ]);
  });
});

/** The fixture with its first photo replaced by `path` / `mediaType`, and the archive entry to match. */
function withFirstPhoto(path: string, mediaType: string) {
  const { manifest, entries } = createVucoBundleFixture();
  const loose = manifest as unknown as Record<string, any>;
  loose.attachments[0].path = path;
  loose.attachments[0].mediaType = mediaType;
  return { manifest: loose, entries: [{ ...entries[0], path }, entries[1]] };
}

describe('photo types (founder decision IG1)', () => {
  it('rejects a media type that is not a photo type, such as SVG', () => {
    const { manifest, entries } = withFirstPhoto('photos/snag-1.svg', 'image/svg+xml');
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'attachment "photo-1": mediaType "image/svg+xml" must be one of image/jpeg, image/png, image/heic, image/webp',
    ]);
  });

  it('rejects a path whose extension does not match the media type', () => {
    const { manifest, entries } = withFirstPhoto('photos/snag-1.png', 'image/jpeg');
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'attachment "photo-1": path "photos/snag-1.png" must end in .jpg or .jpeg for image/jpeg',
    ]);
  });

  it('accepts every photo type with its extensions, ignoring letter case', () => {
    const accepted: [string, string][] = [
      ['photos/a.heic', 'image/heic'],
      ['photos/a.HEIC', 'image/heic'],
      ['photos/a.jpg', 'image/jpeg'],
      ['photos/a.JPEG', 'image/jpeg'],
      ['photos/a.png', 'image/png'],
      ['photos/a.webp', 'image/webp'],
    ];
    for (const [path, mediaType] of accepted) {
      const { manifest, entries } = withFirstPhoto(path, mediaType);
      expect([path, validateVucoBundle(manifest, entries).ok]).toEqual([path, true]);
    }
  });
});

describe('producer (founder decision IG2)', () => {
  it('accepts vuco and any vuco:<name>, and rejects other apps and malformed names', () => {
    const verdicts = ['vuco', 'vuco:walk', 'vuco:x', 'vuco:site-check2', 'other', 'vuco:', 'vuco:Walk', 'vuco:1x', 'VUCO', 'vuco:walk:x', 7].map(
      (app) => {
        const { manifest, entries } = createVucoBundleFixture();
        (manifest as unknown as Record<string, any>).producer.app = app;
        return [app, validateVucoBundle(manifest, entries).ok];
      },
    );
    expect(verdicts).toEqual([
      ['vuco', true],
      ['vuco:walk', true],
      ['vuco:x', true],
      ['vuco:site-check2', true],
      ['other', false],
      ['vuco:', false],
      ['vuco:Walk', false],
      ['vuco:1x', false],
      ['VUCO', false],
      ['vuco:walk:x', false],
      [7, false],
    ]);
  });

  it('requires producer.version to be a MAJOR.EPIC.STORY.BUILD version name', () => {
    const verdicts = ['0.2.0.1', '1.0.0.12', 'banana', '0.2.0', '0.2.0.0', '0.02.0.1', 'v0.2.0.1', '', 201].map((version) => {
      const { manifest, entries } = createVucoBundleFixture();
      (manifest as unknown as Record<string, any>).producer.version = version;
      return [version, errorsOf(validateVucoBundle(manifest, entries))];
    });
    const refusal = (version: unknown) => [
      `producer.version: must be a MAJOR.EPIC.STORY.BUILD version name such as "0.2.0.1", not ${JSON.stringify(version)}`,
    ];
    expect(verdicts).toEqual([
      ['0.2.0.1', []],
      ['1.0.0.12', []],
      ['banana', refusal('banana')],
      ['0.2.0', refusal('0.2.0')],
      ['0.2.0.0', refusal('0.2.0.0')],
      ['0.02.0.1', refusal('0.02.0.1')],
      ['v0.2.0.1', refusal('v0.2.0.1')],
      ['', refusal('')],
      [201, refusal(201)],
    ]);
  });
});

describe('createdAt is a date-time that exists (K8)', () => {
  it('rejects impossible days, months, hours, minutes, seconds and offsets', () => {
    const impossible = [
      '2026-02-30T08:30:00Z',
      '2026-04-31T08:30:00Z',
      '2025-02-29T08:30:00Z',
      '1900-02-29T08:30:00Z',
      '2026-09-16T24:00:00Z',
      '2026-00-10T08:30:00Z',
      '2026-09-00T08:30:00Z',
      '2026-09-16T23:60:00Z',
      '2026-09-16T23:59:60Z',
      '2026-09-16T08:30:00+15:00',
      '2026-09-16T08:30:00+02:60',
    ];
    for (const createdAt of impossible) {
      const { manifest, entries } = createVucoBundleFixture();
      manifest.createdAt = createdAt;
      expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
        `createdAt: must be an ISO 8601 date-time with seconds and a time zone, not "${createdAt}"`,
      ]);
    }
  });

  it('accepts leap days in leap years and the edges of the ranges', () => {
    const real = [
      '2024-02-29T08:30:00Z',
      '2000-02-29T23:59:59Z',
      '2026-12-31T00:00:00.000Z',
      '2026-09-16T08:30:00+14:00',
      '2026-09-16T08:30:00-12:00',
      '2026-09-16T08:30:00+05:45',
    ];
    for (const createdAt of real) {
      const { manifest, entries } = createVucoBundleFixture();
      manifest.createdAt = createdAt;
      expect([createdAt, validateVucoBundle(manifest, entries).ok]).toEqual([createdAt, true]);
    }
  });
});

describe('paths and attachment lists (K9, K10)', () => {
  it('rejects a path that differs from another only by letter case', () => {
    const { manifest, entries } = createVucoBundleFixture();
    manifest.attachments.push({ ...manifest.attachments[1], id: 'photo-3', path: 'photos/Snag-1.png' });
    const archive = [...entries, { ...entries[1], path: 'photos/Snag-1.png' }];
    expect(errorsOf(validateVucoBundle(manifest, archive))).toEqual([
      'attachment "photo-3": path "photos/Snag-1.png" differs from "photos/snag-1.png" only by letter case',
    ]);
  });

  it('rejects a file name longer than 255 characters or ending in a dot', () => {
    const long = `photos/${'a'.repeat(252)}.png`;
    const longest = `photos/${'a'.repeat(251)}.png`;
    const cases: [string, string[]][] = [
      [long, [`attachment "photo-1": path "${long}" has a file name longer than 255 characters`]],
      ['photos/snag-1.png.', ['attachment "photo-1": path "photos/snag-1.png." has a file name that ends in a dot']],
      [longest, []],
    ];
    for (const [path, errors] of cases) {
      const { manifest, entries } = withFirstPhoto(path, 'image/png');
      expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual(errors);
    }
  });

  it('compares entry names exactly as stored: no ./ prefix, no backslashes, same case', () => {
    for (const stored of ['./photos/snag-1.png', 'photos\\snag-1.png', 'photos/SNAG-1.png', '/photos/snag-1.png']) {
      const { manifest, entries } = createVucoBundleFixture();
      const archive = [{ ...entries[0], path: stored }, entries[1]];
      expect([stored, errorsOf(validateVucoBundle(manifest, archive))]).toEqual([
        stored,
        ['attachment "photo-1": photos/snag-1.png is missing from the archive'],
      ]);
    }
  });

  it('rejects a note that lists the same attachment twice', () => {
    const { manifest, entries } = createVucoBundleFixture();
    manifest.notes[0].attachmentIds = ['photo-1', 'photo-2', 'photo-1'];
    expect(errorsOf(validateVucoBundle(manifest, entries))).toEqual([
      'note "note-1": attachmentIds lists "photo-1" more than once',
    ]);
  });
});
