// The `.vuco` hand-over bundle, format version 1 (Story 15.3), minor version 1.1 since kit 0.11.0
// (vuco:walk Story 8.1). One file carries a piece of work, its notes and its photos, from one vuco-family
// app to another: a vuco:walk snag list opened in vuco as a job, for example. The archive layout, the
// field rules, the limits and how to read a bundle safely are in README.md next to this file.

/** The `format` value of every `.vuco` manifest. */
export const VUCO_BUNDLE_FORMAT = 'vuco-bundle';

/** The manifest major version this kit reads. A bundle of any other major version is rejected. */
export const SUPPORTED_FORMAT_MAJOR = 1;

/** The `formatVersion` a writer writes: the newest minor version this kit defines. */
export const VUCO_BUNDLE_FORMAT_VERSION = '1.1';

/**
 * The limits of every 1.x bundle, each inclusive: a bundle at a limit is valid, one over it is not.
 * Characters are Unicode code points, so a letter outside the Basic Multilingual Plane counts once.
 */
export const VUCO_BUNDLE_LIMITS = {
  /** Notes in `notes`. */
  notes: 10_000,
  /** Attachments in `attachments`. */
  attachments: 20_000,
  /** Entries in the archive, `manifest.json` and entries no attachment names included. */
  entries: 25_000,
  /** Bytes of one attachment (32 MiB). */
  attachmentBytes: 32 * 1024 * 1024,
  /** Bytes of all attachments together. */
  totalAttachmentBytes: 2_000_000_000,
  /** Bytes of `manifest.json` (16 MiB). */
  manifestBytes: 16 * 1024 * 1024,
  /** Characters of one note's `text`. */
  noteTextChars: 20_000,
  /** Characters of the `title`, of a note's `trade`, and of each name in a note's `location`. */
  nameChars: 500,
  /** Names in a note's `location`. */
  locationLevels: 10,
} as const;

/** A note's `status` (1.1). */
export const VUCO_BUNDLE_STATUSES = ['open', 'closed'] as const;

export type VucoBundleStatus = (typeof VUCO_BUNDLE_STATUSES)[number];

/** A note's `priority` (1.1). */
export const VUCO_BUNDLE_PRIORITIES = ['high', 'medium', 'low'] as const;

export type VucoBundlePriority = (typeof VUCO_BUNDLE_PRIORITIES)[number];

/** Where the manifest sits in the ZIP archive: at the root. */
export const VUCO_BUNDLE_MANIFEST_PATH = 'manifest.json';

/** The ZIP folder that holds every attachment, directly (no subfolders). */
export const VUCO_BUNDLE_PHOTOS_DIR = 'photos/';

/**
 * `producer.app`: `vuco`, or `vuco:<name>` for any family app (`<name>` starts with a lowercase letter,
 * then lowercase letters, digits and `-`). The app that imports a bundle decides which producers and
 * kinds it opens; the format itself refuses no family app.
 */
export const VUCO_BUNDLE_PRODUCER_APP = /^vuco(?::[a-z][a-z0-9-]*)?$/;

export type VucoBundleProducerApp = 'vuco' | `vuco:${string}`;

/** The photo types a bundle may hold, each with the file extensions it allows (compared ignoring case). */
export const VUCO_BUNDLE_PHOTO_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/heic': ['.heic'],
  'image/webp': ['.webp'],
} as const;

export type VucoBundlePhotoType = keyof typeof VUCO_BUNDLE_PHOTO_TYPES;

export interface VucoBundleProducer {
  app: VucoBundleProducerApp;
  /** The producing app's `MAJOR.EPIC.STORY.BUILD` version name, e.g. `0.2.0.1`. */
  version: string;
}

/**
 * One row of a note's before and after photos (1.1): the ids of two of the note's own attachments, or of
 * one when that side has no photo.
 */
export interface VucoBundlePhotoPair {
  before?: string;
  after?: string;
}

export interface VucoBundleNote {
  id: string;
  /** May be empty. */
  text: string;
  /** Ids of entries in `attachments`, each at most once. */
  attachmentIds?: string[];
  /** 1.1: where the note applies, as location names from the outermost level in, at least one. */
  location?: string[];
  /** 1.1: the trade the work falls to. */
  trade?: string;
  /** 1.1: `open` or `closed`. */
  status?: VucoBundleStatus;
  /** 1.1: `high`, `medium` or `low`. */
  priority?: VucoBundlePriority;
  /** 1.1: the day the work is due, `YYYY-MM-DD`. */
  dueDate?: string;
  /**
   * 1.1: the before and after photos side by side, oldest first. Each id is one of the note's
   * `attachmentIds`, and no id appears twice across the pairs.
   */
  photoPairs?: VucoBundlePhotoPair[];
}

export interface VucoBundleAttachment {
  id: string;
  /** `photos/<file name>`, with an extension that matches `mediaType`. */
  path: string;
  mediaType: VucoBundlePhotoType;
  byteLength: number;
  /** SHA-256 of the file's bytes, 64 lowercase hex digits. */
  sha256: string;
}

/** `manifest.json`. Readers ignore fields they do not know, so a minor version can add fields. */
export interface VucoBundleManifest {
  format: typeof VUCO_BUNDLE_FORMAT;
  /** `MAJOR.MINOR`, e.g. `1.1`. A writer writes `VUCO_BUNDLE_FORMAT_VERSION`. */
  formatVersion: string;
  producer: VucoBundleProducer;
  /** What the bundle holds, as a lowercase kebab-case name, e.g. `snag-list`. */
  kind: string;
  /** When the bundle was written: a real ISO 8601 date-time with seconds and a time zone. */
  createdAt: string;
  /**
   * 1.1: the hand-over's id, a lowercase RFC 9562 UUID. A hand-over sent again keeps its id, so a
   * reader can tell a repeat.
   */
  bundleId?: string;
  /** 1.1: the name of the piece of work. */
  title?: string;
  /** 1.1: the language of the title, the notes, the trades and the location names, `xx` or `xx-YY`. */
  language?: string;
  notes: VucoBundleNote[];
  attachments: VucoBundleAttachment[];
}

/**
 * One file in the ZIP archive, as the caller read it: its entry name exactly as stored (forward
 * slashes, no leading `./`), its size, and the SHA-256 of its bytes. The caller passes every entry,
 * `manifest.json` included: every entry counts toward the entry limit, `manifest.json`'s size is checked
 * against its limit, and an entry that an attachment names has its size and digest compared.
 */
export interface VucoBundleEntry {
  path: string;
  byteLength: number;
  sha256: string;
}

export type VucoBundleValidation = { ok: true; manifest: VucoBundleManifest } | { ok: false; errors: string[] };
