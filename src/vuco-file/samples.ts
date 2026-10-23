// Sample `.vuco` 1.1 snag lists (vuco:walk Story 8.1): bundles as vuco:walk writes them, for the apps that
// write and read bundles to build and test against. Nothing here comes from a real job, place or person.
//
// As vuco:walk writes them:
// - note and attachment ids are UUIDv7s (RFC 9562), and each photo is a JPEG at photos/<attachment id>.jpg;
// - a note's text is the item's "<number>. <title>", its location path joined by " › ", then its
//   description, one line each, a line left out when empty.
//
// The photos are 160-byte 1×1 grey baseline JPEGs that differ only in their two scan bytes. Their digests
// are written out, not computed, because the kit never hashes; test/vuco-file/samples.test.ts proves they
// are the real SHA-256 of these bytes.

import type { VucoBundleFixture, VucoBundleFixturePhoto } from './fixtures';
import { VUCO_BUNDLE_FORMAT_VERSION, type VucoBundleEntry, type VucoBundleManifest } from './types';

export interface VucoSnagListSamples {
  /**
   * A first walk, in English: open items, each 1.1 note field at least once, and items with none of
   * them (text and photos only).
   */
  firstWalk: VucoBundleFixture;
  /**
   * After a finished re-inspection round, in German: open and closed items, an item with two before
   * photos and one after, an after photo with no before, and an item added after the round.
   */
  reinspected: VucoBundleFixture;
}

// A 1×1 grey baseline JPEG up to its scan data: SOI; a JFIF 1.1 APP0; one quantisation table (8 for the DC
// coefficient, 1 for every AC one); SOF0 for 1×1 pixel, one component; a DC table whose one code stands
// for category 7 and an AC table whose one code ends the block; SOS.
const JPEG_HEAD = [
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, ...new Array<number>(63).fill(0x01),
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, ...new Array<number>(15).fill(0x00), 0x07,
  0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, ...new Array<number>(15).fill(0x00), 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
];
const JPEG_END = [0xff, 0xd9];

/**
 * The photo of grey level `grey` (at most 64, or at least 192: DC category 7). Its scan holds the DC code
 * and 7 value bits, then the end-of-block code and padding.
 */
function jpeg(grey: number): number[] {
  const value = grey < 128 ? grey - 1 : grey - 128;
  return [...JPEG_HEAD, value, 0x7f, ...JPEG_END];
}

interface SamplePhoto {
  id: string;
  grey: number;
  sha256: string;
}

function photosOf(samplePhotos: readonly SamplePhoto[]): VucoBundleFixturePhoto[] {
  return samplePhotos.map(({ id, grey, sha256 }) => ({
    path: `photos/${id}.jpg`,
    mediaType: 'image/jpeg',
    bytes: Uint8Array.from(jpeg(grey)),
    sha256,
  }));
}

/** The sample with its photos: the manifest's attachments, in the photos' order, and their archive entries. */
function sample(manifest: Omit<VucoBundleManifest, 'attachments'>, samplePhotos: readonly SamplePhoto[]): VucoBundleFixture {
  const photos = photosOf(samplePhotos);
  const attachments = photos.map((photo, index) => ({
    id: samplePhotos[index].id,
    path: photo.path,
    mediaType: photo.mediaType,
    byteLength: photo.bytes.length,
    sha256: photo.sha256,
  }));
  // The entries of the photos. A caller also passes manifest.json's entry, whose size depends on how the
  // manifest is written.
  const entries: VucoBundleEntry[] = photos.map(({ path, bytes, sha256 }) => ({ path, byteLength: bytes.length, sha256 }));
  return { manifest: { ...manifest, attachments }, entries, photos };
}

// firstWalk: a walk on 21 October 2026, handed over at 09:40 UTC.
const WALK_PHOTOS = {
  tile: { id: '01a15d7b-ec31-732a-a6dd-d0ac761e49e9', grey: 24, sha256: '6e020900d2de0a9cdcd29a1c8b7121e292bf12fd85680cd0deba13b399b5c730' },
  sillLeft: { id: '01a15d80-1afa-72fe-98c9-1af068a96d70', grey: 32, sha256: '2d4ce84ecada866ebfb692c3e6906802af687b2a19e79387b92a67ba1ed5082d' },
  sillRight: { id: '01a15d80-73d0-77f5-aa14-0d68a2b997ae', grey: 40, sha256: '7cc1a8232409af02dabcc647dc83242d7813b2b1fb3d7d2b3b56f1878f94bba1' },
  paint: { id: '01a15d88-8363-767f-8477-68005849200a', grey: 48, sha256: 'aef6fc3a771c8759840374db09a14ef0ec471a3cd1a4098e74a9eafb0d7dcd6c' },
} as const;

function firstWalk(): VucoBundleFixture {
  const { tile, sillLeft, sillRight, paint } = WALK_PHOTOS;
  return sample(
    {
      format: 'vuco-bundle',
      formatVersion: VUCO_BUNDLE_FORMAT_VERSION,
      producer: { app: 'vuco:walk', version: '0.6.6.1' },
      kind: 'snag-list',
      createdAt: '2026-10-21T09:40:12Z',
      bundleId: '01a15dd5-2602-7650-9f8e-0131f6dc3d41',
      title: 'Example House, Flat 3',
      language: 'en',
      notes: [
        {
          id: '01a15d7b-b6a7-7b2c-92f0-ab9c25490e4f',
          text: '1. Cracked tile next to the shower tray\nFlat 3 › Bathroom › Shower\nHairline crack across the second tile from the left.',
          attachmentIds: [tile.id],
          location: ['Flat 3', 'Bathroom', 'Shower'],
          trade: 'Tiling',
          status: 'open',
          priority: 'high',
          dueDate: '2026-11-06',
          photoPairs: [{ before: tile.id }],
        },
        {
          // No description, so no third line; no due date.
          id: '01a15d7f-e659-7498-914e-9c758a9bd797',
          text: '2. Silicone joint missing along the window sill\nFlat 3 › Kitchen',
          attachmentIds: [sillLeft.id, sillRight.id],
          location: ['Flat 3', 'Kitchen'],
          trade: 'Sealing',
          status: 'open',
          priority: 'medium',
          photoPairs: [{ before: sillLeft.id }, { before: sillRight.id }],
        },
        {
          // No trade and no photos.
          id: '01a15d85-479c-7b7d-a04d-ab8aedebecab',
          text: '3. Door stop is loose\nFlat 3 › Hallway\nThe screw turns in its plug.',
          location: ['Flat 3', 'Hallway'],
          status: 'open',
          priority: 'low',
          dueDate: '2026-11-20',
        },
        // Two items with none of the 1.1 note fields: text and photos only.
        {
          id: '01a15d88-66a5-7320-864b-f24327ad2572',
          text: '4. Paint splashes on the skirting board\nFlat 3 › Living room\nAlong the wall by the door.',
          attachmentIds: [paint.id],
        },
        {
          id: '01a15d8d-5afc-7b8a-8569-93e9548024d1',
          text: '5. Window handle sticks\nFlat 3 › Bedroom',
        },
      ],
    },
    [tile, sillLeft, sillRight, paint],
  );
}

// reinspected: a walk on 27 October 2026, a re-inspection round on 10 November, finished, then one more
// item, and the hand-over at 15:52 Central European Time.
const ROUND_PHOTOS = {
  tileBefore: { id: '01a17c9a-8ade-7e13-bb45-7aec10770ae8', grey: 16, sha256: '5e5a47aab20f76187504303e21aa57560fc2652ed3c96d47d77ad39e477f49c9' },
  tileCloseUp: { id: '01a17c9a-ea08-7f86-9494-21625f0142bc', grey: 56, sha256: '405ebd8052b9689bd47d1f264b6c77953372d5874d9bf6de42bab2e64a88129e' },
  sillBefore: { id: '01a17ca0-7346-74ac-8e20-6f417c9c3d42', grey: 64, sha256: '1934cf5ca7059d0421504f7f69e6f078c2d80129a99334d0a687b9ed6e3081d1' },
  tileAfter: { id: '01a1c59f-17a8-7011-97bf-5a8c1ffdb336', grey: 200, sha256: 'aed69b7a8eda049af6a1785e836f08261305f14ae0617b4b11dbe5eca21ec471' },
  sillAfter: { id: '01a1c5a4-4213-7565-9dbd-9b89f44c8cb5', grey: 216, sha256: '65908d21fab4cfc781dfe5abc49b805bd70e96db6aa2b03900195182c0f2d8f1' },
  doorStopAfter: { id: '01a1c5a8-7a94-71c7-84bb-2e45653592d9', grey: 232, sha256: 'e246fdfc6540d60d64a66b13a7112771152e4edcdbd5cef7b26a072efcc2ccea' },
  frameBefore: { id: '01a1c5c7-6387-724e-becb-68b543a486a4', grey: 8, sha256: '409ada243427a3f851976f4bc90be940e5d6c6cadb9482dddeb56dbf5aaf56ce' },
} as const;

function reinspected(): VucoBundleFixture {
  const { tileBefore, tileCloseUp, sillBefore, tileAfter, sillAfter, doorStopAfter, frameBefore } = ROUND_PHOTOS;
  return sample(
    {
      format: 'vuco-bundle',
      formatVersion: VUCO_BUNDLE_FORMAT_VERSION,
      producer: { app: 'vuco:walk', version: '0.6.6.1' },
      kind: 'snag-list',
      createdAt: '2026-11-10T15:52:06+01:00',
      bundleId: '01a1c5f1-e4cb-7a2f-8104-8dfd1ea89a31',
      title: 'Musterhaus, Wohnung 2',
      language: 'de',
      notes: [
        {
          // Closed in the round: two before photos and one after, so the second row has no after photo.
          id: '01a17c9a-5a2d-7e7a-8c0d-0effd40ef4e0',
          text: '1. Riss in der Fliese neben der Duschwanne\nWohnung 2 › Bad › Dusche\nZweite Fliese von links.',
          attachmentIds: [tileBefore.id, tileCloseUp.id, tileAfter.id],
          location: ['Wohnung 2', 'Bad', 'Dusche'],
          trade: 'Fliesenarbeiten',
          status: 'closed',
          priority: 'high',
          dueDate: '2026-11-06',
          photoPairs: [{ before: tileBefore.id, after: tileAfter.id }, { before: tileCloseUp.id }],
        },
        {
          // Still open after the round, with its after photo.
          id: '01a17ca0-3749-7287-b3db-bf85758e9317',
          text: '2. Silikonfuge am Fensterbrett fehlt\nWohnung 2 › Küche',
          attachmentIds: [sillBefore.id, sillAfter.id],
          location: ['Wohnung 2', 'Küche'],
          trade: 'Abdichtung',
          status: 'open',
          priority: 'medium',
          dueDate: '2026-11-20',
          photoPairs: [{ before: sillBefore.id, after: sillAfter.id }],
        },
        {
          // Closed in the round, with an after photo and no before photo.
          id: '01a17ca4-4995-70f8-bf4e-5255d1e26f14',
          text: '3. Türstopper im Flur locker\nWohnung 2 › Flur',
          attachmentIds: [doorStopAfter.id],
          location: ['Wohnung 2', 'Flur'],
          status: 'closed',
          priority: 'low',
          photoPairs: [{ after: doorStopAfter.id }],
        },
        {
          // Added after the round finished, so outside it: open, with a before photo only.
          id: '01a1c5c7-3676-7065-af34-cb15758d2ac1',
          text: '4. Kratzer am Rahmen der Balkontür\nWohnung 2 › Wohnzimmer\nUnten links, etwa 10 cm lang.',
          attachmentIds: [frameBefore.id],
          location: ['Wohnung 2', 'Wohnzimmer'],
          trade: 'Malerarbeiten',
          status: 'open',
          photoPairs: [{ before: frameBefore.id }],
        },
      ],
    },
    [tileBefore, tileCloseUp, sillBefore, tileAfter, sillAfter, doorStopAfter, frameBefore],
  );
}

/** Fresh samples on every call, so a test can change its copy freely. */
export function createVucoSnagListSamples(): VucoSnagListSamples {
  return { firstWalk: firstWalk(), reinspected: reinspected() };
}
