/// <reference types="node" />
// The `.vuco` 1.1 snag-list samples (vuco:walk Story 8.1): each a valid 1.1 bundle, fresh on every call,
// with the real SHA-256 of its JPEG photos, and showing what vuco:walk writes.
import { createHash } from 'node:crypto';

import {
  createVucoSnagListSamples,
  validateVucoBundle,
  VUCO_BUNDLE_FORMAT_VERSION,
  type VucoBundleFixture,
  type VucoBundleNote,
} from '../../src/vuco-file';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOTE_FIELDS = ['location', 'trade', 'status', 'priority', 'dueDate', 'photoPairs'] as const;
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;

function allSamples(): [string, VucoBundleFixture][] {
  return Object.entries(createVucoSnagListSamples());
}

/**
 * The markers of a JPEG file in order, from SOI to EOI, and its SOF0 segment. Throws when the bytes are
 * not marker segments up to SOS, then a scan with every 0xff stuffed, then EOI as the last two bytes.
 */
function jpegLayout(bytes: Uint8Array): { markers: number[]; frame: number[] } {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) throw new Error('no SOI');
  const markers = [SOI];
  let frame: number[] = [];
  let at = 2;
  for (;;) {
    if (bytes[at] !== 0xff) throw new Error(`no marker at byte ${at}`);
    const marker = bytes[at + 1];
    const length = bytes[at + 2] * 256 + bytes[at + 3];
    markers.push(marker);
    if (marker === 0xc0) frame = Array.from(bytes.subarray(at + 4, at + 2 + length));
    at += 2 + length;
    if (marker === SOS) break;
  }
  while (at < bytes.length - 2) {
    if (bytes[at] === 0xff) {
      if (bytes[at + 1] !== 0x00) throw new Error(`a marker inside the scan at byte ${at}`);
      at += 1;
    }
    at += 1;
  }
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== EOI) throw new Error('no EOI at the end');
  markers.push(EOI);
  return { markers, frame };
}

function hasNoteField(note: VucoBundleNote): boolean {
  return NOTE_FIELDS.some((field) => note[field] !== undefined);
}

describe('the snag-list samples', () => {
  it('are valid 1.1 bundles, and the validator hands back each manifest', () => {
    const names = allSamples().map(([name, { manifest, entries }]) => {
      expect(manifest.formatVersion).toBe(VUCO_BUNDLE_FORMAT_VERSION);
      expect(VUCO_BUNDLE_FORMAT_VERSION).toBe('1.1');
      expect(validateVucoBundle(manifest, entries)).toEqual({ ok: true, manifest });
      // With manifest.json's entry too, as a reader passes it.
      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest)).length;
      const archive = [{ path: 'manifest.json', byteLength: manifestBytes, sha256: '' }, ...entries];
      expect(validateVucoBundle(manifest, archive).ok).toBe(true);
      return name;
    });
    expect(names).toEqual(['firstWalk', 'reinspected']);
  });

  it('are fresh on every call', () => {
    const first = createVucoSnagListSamples();
    first.firstWalk.manifest.notes.length = 0;
    first.reinspected.manifest.notes[0].photoPairs?.splice(0);
    first.reinspected.photos[0].bytes[0] = 0;
    first.reinspected.entries.length = 0;
    const second = createVucoSnagListSamples();
    expect(second.firstWalk.manifest.notes).toHaveLength(5);
    expect(second.reinspected.manifest.notes[0].photoPairs).toHaveLength(2);
    expect(second.reinspected.photos[0].bytes[0]).toBe(0xff);
    expect(second.reinspected.entries).toHaveLength(7);
    expect(second).toEqual(createVucoSnagListSamples());
  });

  it('carry the real SHA-256 and size of each photo, and the photos are distinct 1×1 JPEG files', () => {
    const digests = new Set<string>();
    for (const [, { manifest, entries, photos }] of allSamples()) {
      expect(photos).toHaveLength(manifest.attachments.length);
      photos.forEach((photo, index) => {
        expect(createHash('sha256').update(photo.bytes).digest('hex')).toBe(photo.sha256);
        const { markers, frame } = jpegLayout(photo.bytes);
        // SOI, APP0 (JFIF), DQT, SOF0, two DHT, SOS, EOI.
        expect(markers).toEqual([SOI, 0xe0, 0xdb, 0xc0, 0xc4, 0xc4, SOS, EOI]);
        expect(Array.from(photo.bytes.subarray(6, 11))).toEqual([0x4a, 0x46, 0x49, 0x46, 0x00]);
        // 8-bit precision, 1 pixel high, 1 pixel wide, one component.
        expect(frame.slice(0, 6)).toEqual([0x08, 0x00, 0x01, 0x00, 0x01, 0x01]);
        const attachment = manifest.attachments[index];
        expect(attachment).toEqual({
          id: attachment.id,
          path: `photos/${attachment.id}.jpg`,
          mediaType: 'image/jpeg',
          byteLength: photo.bytes.length,
          sha256: photo.sha256,
        });
        expect(photo).toMatchObject({ path: attachment.path, mediaType: 'image/jpeg' });
        expect(entries[index]).toEqual({ path: photo.path, byteLength: photo.bytes.length, sha256: photo.sha256 });
        digests.add(photo.sha256);
      });
      expect(entries).toHaveLength(photos.length);
    }
    expect(digests.size).toBe(11);
  });

  it('use UUIDv7 ids for the bundle, its notes and its photos', () => {
    for (const [, { manifest }] of allSamples()) {
      const ids = [manifest.bundleId, ...manifest.notes.map((note) => note.id), ...manifest.attachments.map((attachment) => attachment.id)];
      for (const id of ids) expect([id, UUID_V7.test(id ?? '')]).toEqual([id, true]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('write each note text as vuco:walk does: number and title, location path, then the description and its line breaks', () => {
    let fourLevels = 0;
    let multiLineDescriptions = 0;
    for (const [, { manifest }] of allSamples()) {
      manifest.notes.forEach((note, index) => {
        const [first, second, ...description] = note.text.split('\n');
        // "<number>. <title>", or "<number>." for an item without a title.
        const number = `${index + 1}.`;
        expect(first === number || (first.startsWith(`${number} `) && first.length > number.length + 1 && first === first.trim())).toBe(true);
        // The location path joined by " › "; a line is left out when empty, so none here is.
        expect(second.split(' › ').every((name) => name.trim() !== '')).toBe(true);
        if (note.location !== undefined) expect(second).toBe(note.location.join(' › '));
        expect(description.every((line) => line.trim() !== '')).toBe(true);
        if ((note.location?.length ?? 0) >= 4) fourLevels += 1;
        if (description.length > 1) multiLineDescriptions += 1;
      });
    }
    expect([fourLevels, multiLineDescriptions]).toEqual([1, 1]);
  });

  it('pair photos oldest first, from each note’s own photos', () => {
    for (const [, { manifest }] of allSamples()) {
      for (const note of manifest.notes) {
        const pairs = note.photoPairs ?? [];
        for (const side of ['before', 'after'] as const) {
          const ids = pairs.map((pair) => pair[side]).filter((id): id is string => id !== undefined);
          // A UUIDv7 leads with its time, so ids sort by when the photo was taken; a column never has a gap.
          expect(ids).toEqual([...ids].sort());
          expect(pairs.slice(0, ids.length).every((pair) => pair[side] !== undefined)).toBe(true);
        }
        const paired = pairs.flatMap((pair) => [pair.before, pair.after]).filter((id) => id !== undefined);
        if (pairs.length > 0) expect([...paired].sort()).toEqual([...(note.attachmentIds ?? [])].sort());
      }
    }
  });
});

describe('firstWalk', () => {
  it('is in English, with open items, every 1.1 note field at least once, and items with none of them', () => {
    const { manifest } = createVucoSnagListSamples().firstWalk;
    expect(manifest).toMatchObject({ language: 'en', producer: { app: 'vuco:walk' }, kind: 'snag-list' });
    expect(manifest.title).toBeTruthy();
    for (const field of NOTE_FIELDS) expect([field, manifest.notes.some((note) => note[field] !== undefined)]).toEqual([field, true]);
    expect(manifest.notes.filter((note) => !hasNoteField(note)).length).toBeGreaterThanOrEqual(2);
    expect(manifest.notes.every((note) => note.status === undefined || note.status === 'open')).toBe(true);
    expect(manifest.notes.some((note) => note.photoPairs?.some((pair) => pair.after !== undefined))).toBe(false);
  });
});

describe('reinspected', () => {
  const { manifest } = createVucoSnagListSamples().reinspected;
  const afterIds = manifest.notes.flatMap((note) => (note.photoPairs ?? []).map((pair) => pair.after)).filter((id) => id !== undefined);
  const lastAfter = [...afterIds].sort().pop() ?? '';

  it('is in German, with open and closed items after a finished round', () => {
    expect(manifest).toMatchObject({ language: 'de', producer: { app: 'vuco:walk' }, kind: 'snag-list' });
    expect(manifest.notes.every(hasNoteField)).toBe(true);
    expect(new Set(manifest.notes.map((note) => note.status))).toEqual(new Set(['open', 'closed']));
    expect(afterIds.length).toBeGreaterThan(0);
  });

  it('pairs two before photos with one after, leaving the second row without an after photo', () => {
    const twoBefore = manifest.notes.find((note) => note.photoPairs?.length === 2);
    expect(twoBefore?.photoPairs).toEqual([
      { before: expect.any(String), after: expect.any(String) },
      { before: expect.any(String) },
    ]);
  });

  it('has an after photo with no before', () => {
    expect(manifest.notes.some((note) => note.photoPairs?.length === 1 && note.photoPairs[0].before === undefined && note.photoPairs[0].after !== undefined)).toBe(true);
  });

  it('has an item outside the round: added after its last after photo, open, with before photos only', () => {
    const outside = manifest.notes.filter((note) => note.id > lastAfter);
    expect(outside).toHaveLength(1);
    expect(outside[0].status).toBe('open');
    expect(outside[0].photoPairs?.every((pair) => pair.after === undefined && pair.before !== undefined)).toBe(true);
  });
});
