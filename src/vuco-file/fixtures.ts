// Synthetic `.vuco` fixtures (Story 15.3): two 67-byte PNG photos (1×1 grey pixels), their real
// SHA-256 digests, and a valid version 1 manifest with the matching archive entries. Nothing here comes
// from a real job, place or person. The digests are written out, not computed, because the kit never
// hashes; test/vuco-file/validate.test.ts proves they are the real digests of these bytes.

import type { VucoBundleEntry, VucoBundleManifest, VucoBundlePhotoType } from './types';

export interface VucoBundleFixturePhoto {
  path: string;
  mediaType: VucoBundlePhotoType;
  bytes: Uint8Array;
  sha256: string;
}

export interface VucoBundleFixture {
  manifest: VucoBundleManifest;
  /** The archive entries a caller would pass for the two photos. */
  entries: VucoBundleEntry[];
  photos: VucoBundleFixturePhoto[];
}

const PNG_HEADER = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x7e, 0x9b, 0x55, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63,
];
const PNG_END = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

const PHOTOS = [
  {
    path: 'photos/snag-1.png',
    // grey 0x40: the compressed pixel row, the IDAT checksum
    bytes: [...PNG_HEADER, 0x70, 0x00, 0x00, 0x00, 0x42, 0x00, 0x41, 0x29, 0x37, 0xf4, 0xef, ...PNG_END],
    sha256: '867ccba653be2ff941ddb46a30fddca1f706f37c083f9f57a98ed3e1698b8c58',
  },
  {
    path: 'photos/snag-2.png',
    // grey 0xc0
    bytes: [...PNG_HEADER, 0x38, 0x00, 0x00, 0x00, 0xc2, 0x00, 0xc1, 0x52, 0x5e, 0x57, 0x51, ...PNG_END],
    sha256: 'd83d1f487988dc75e7b6275afa8ab3209e8ee87a4b38ab887cc4ea11cc201ec0',
  },
] as const;

/** A fresh fixture on every call, so a test can change its copy freely. */
export function createVucoBundleFixture(): VucoBundleFixture {
  const photos: VucoBundleFixturePhoto[] = PHOTOS.map(({ path, bytes, sha256 }) => ({
    path,
    mediaType: 'image/png',
    bytes: Uint8Array.from(bytes),
    sha256,
  }));
  const manifest: VucoBundleManifest = {
    format: 'vuco-bundle',
    formatVersion: '1.0',
    producer: { app: 'vuco:walk', version: '0.1.0.1' },
    kind: 'snag-list',
    createdAt: '2026-09-16T08:30:00Z',
    notes: [
      { id: 'note-1', text: 'Cracked tile next to the shower tray', attachmentIds: ['photo-1'] },
      { id: 'note-2', text: 'Silicone joint missing along the window sill', attachmentIds: ['photo-2'] },
      { id: 'note-3', text: 'Door stop in the hallway is loose' },
    ],
    attachments: photos.map((photo, index) => ({
      id: `photo-${index + 1}`,
      path: photo.path,
      mediaType: photo.mediaType,
      byteLength: photo.bytes.length,
      sha256: photo.sha256,
    })),
  };
  const entries: VucoBundleEntry[] = photos.map(({ path, bytes, sha256 }) => ({
    path,
    byteLength: bytes.length,
    sha256,
  }));
  return { manifest, entries, photos };
}
