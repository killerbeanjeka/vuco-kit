// The `.vuco` hand-over bundle, format version 1 (Story 15.3). One file carries a piece of work, its
// notes and its photos, from one vuco-family app to another: a vuco:walk snag list opened in vuco as a
// job, for example. The archive layout and the field rules are in README.md next to this file.

/** The `format` value of every `.vuco` manifest. */
export const VUCO_BUNDLE_FORMAT = 'vuco-bundle';

/** The manifest major version this kit reads. A bundle of any other major version is rejected. */
export const SUPPORTED_FORMAT_MAJOR = 1;

/** Where the manifest sits in the ZIP archive: at the root. */
export const VUCO_BUNDLE_MANIFEST_PATH = 'manifest.json';

/** The ZIP folder that holds every attachment, directly (no subfolders). */
export const VUCO_BUNDLE_PHOTOS_DIR = 'photos/';

/** The apps that write `.vuco` bundles. */
export const VUCO_BUNDLE_PRODUCERS = ['vuco', 'vuco:walk'] as const;

export type VucoBundleProducerApp = (typeof VUCO_BUNDLE_PRODUCERS)[number];

export interface VucoBundleProducer {
  app: VucoBundleProducerApp;
  /** The producing app's version name, e.g. `0.2.0.1`. */
  version: string;
}

export interface VucoBundleNote {
  id: string;
  text: string;
  /** Ids of entries in `attachments`. */
  attachmentIds?: string[];
}

export interface VucoBundleAttachment {
  id: string;
  /** `photos/<file name>` */
  path: string;
  /** An `image/*` media type. */
  mediaType: string;
  byteLength: number;
  /** SHA-256 of the file's bytes, 64 lowercase hex digits. */
  sha256: string;
}

/** `manifest.json`. Readers ignore fields they do not know, so a minor version can add fields. */
export interface VucoBundleManifest {
  format: typeof VUCO_BUNDLE_FORMAT;
  /** `MAJOR.MINOR`, e.g. `1.0`. */
  formatVersion: string;
  producer: VucoBundleProducer;
  /** What the bundle holds, as a lowercase kebab-case name, e.g. `snag-list`. */
  kind: string;
  /** When the bundle was written: an ISO 8601 date-time with seconds and a time zone. */
  createdAt: string;
  notes: VucoBundleNote[];
  attachments: VucoBundleAttachment[];
}

/** One file in the ZIP archive, as the caller read it: its path, its size and its SHA-256. */
export interface VucoBundleEntry {
  path: string;
  byteLength: number;
  sha256: string;
}

export type VucoBundleValidation = { ok: true; manifest: VucoBundleManifest } | { ok: false; errors: string[] };
