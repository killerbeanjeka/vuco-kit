// Validates a `.vuco` manifest against the archive entries the caller read (Story 15.3). The kit never
// opens, writes, hashes or sends a bundle: the caller unzips it, parses manifest.json and passes each
// entry's path, size and SHA-256. Unknown manifest fields and archive entries no attachment names are
// ignored, so a 1.x bundle from a newer writer still validates.

import {
  SUPPORTED_FORMAT_MAJOR,
  VUCO_BUNDLE_FORMAT,
  VUCO_BUNDLE_PHOTOS_DIR,
  VUCO_BUNDLE_PRODUCERS,
  type VucoBundleEntry,
  type VucoBundleManifest,
  type VucoBundleValidation,
} from './types';

const FORMAT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const KIND = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CREATED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
// A file directly under photos/, with a portable name that is not hidden and cannot climb out.
const FILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const MEDIA_TYPE = /^image\/[a-z0-9][a-z0-9.+-]*$/;
const SHA256 = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPhotoPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(VUCO_BUNDLE_PHOTOS_DIR) &&
    FILE_NAME.test(path.slice(VUCO_BUNDLE_PHOTOS_DIR.length))
  );
}

/** The format and its major version. A bundle that fails here is not read any further. */
function formatErrors(manifest: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (manifest.format !== VUCO_BUNDLE_FORMAT) {
    errors.push(`format: must be "${VUCO_BUNDLE_FORMAT}", not ${JSON.stringify(manifest.format)}`);
  }
  const version = typeof manifest.formatVersion === 'string' ? FORMAT_VERSION.exec(manifest.formatVersion) : null;
  if (!version) {
    errors.push(`formatVersion: must be "MAJOR.MINOR", not ${JSON.stringify(manifest.formatVersion)}`);
  } else if (Number(version[1]) !== SUPPORTED_FORMAT_MAJOR) {
    errors.push(
      `formatVersion ${manifest.formatVersion}: major version ${version[1]} is not supported; this reader reads ${SUPPORTED_FORMAT_MAJOR}.x`,
    );
  }
  return errors;
}

function headerErrors(manifest: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const { producer, kind, createdAt } = manifest;
  if (!isRecord(producer)) {
    errors.push('producer: must be an object with app and version');
  } else {
    if (!(VUCO_BUNDLE_PRODUCERS as readonly unknown[]).includes(producer.app)) {
      errors.push(`producer.app: must be one of ${VUCO_BUNDLE_PRODUCERS.join(', ')}, not ${JSON.stringify(producer.app)}`);
    }
    if (!isNonEmptyString(producer.version)) errors.push('producer.version: must be a non-empty string');
  }
  if (typeof kind !== 'string' || !KIND.test(kind)) {
    errors.push(`kind: must be a lowercase kebab-case name such as "snag-list", not ${JSON.stringify(kind)}`);
  }
  if (typeof createdAt !== 'string' || !CREATED_AT.test(createdAt) || Number.isNaN(Date.parse(createdAt))) {
    errors.push(`createdAt: must be an ISO 8601 date-time with seconds and a time zone, not ${JSON.stringify(createdAt)}`);
  }
  return errors;
}

/** Attachment shapes, uniqueness, and the match with the archive entries. Returns the known ids. */
function attachmentErrors(attachments: unknown, entries: readonly unknown[], errors: string[]): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(attachments)) {
    errors.push('attachments: must be an array');
    return ids;
  }
  const paths = new Set<string>();
  attachments.forEach((attachment: unknown, index) => {
    if (!isRecord(attachment)) {
      errors.push(`attachments[${index}]: must be an object`);
      return;
    }
    const { id, path, mediaType, byteLength, sha256 } = attachment;
    const name = isNonEmptyString(id) ? `attachment "${id}"` : `attachments[${index}]`;
    if (!isNonEmptyString(id)) errors.push(`${name}: id must be a non-empty string`);
    else if (ids.has(id)) errors.push(`${name}: duplicate id`);
    else ids.add(id);

    const pathOk = isPhotoPath(path);
    if (!pathOk) {
      errors.push(`${name}: path ${JSON.stringify(path)} must name a file directly under ${VUCO_BUNDLE_PHOTOS_DIR}`);
    } else if (paths.has(path)) {
      errors.push(`${name}: duplicate path "${path}"`);
    } else {
      paths.add(path);
    }
    if (typeof mediaType !== 'string' || !MEDIA_TYPE.test(mediaType)) {
      errors.push(`${name}: mediaType ${JSON.stringify(mediaType)} must be an image/* type`);
    }
    const sizeOk = typeof byteLength === 'number' && Number.isSafeInteger(byteLength) && byteLength > 0;
    if (!sizeOk) errors.push(`${name}: byteLength must be a positive integer, not ${JSON.stringify(byteLength)}`);
    const hashOk = typeof sha256 === 'string' && SHA256.test(sha256);
    if (!hashOk) errors.push(`${name}: sha256 must be 64 lowercase hex digits`);
    if (!pathOk) return;

    const inArchive = entries.filter((entry) => isRecord(entry) && entry.path === path);
    if (inArchive.length === 0) {
      errors.push(`${name}: ${path} is missing from the archive`);
      return;
    }
    if (inArchive.length > 1) {
      errors.push(`${name}: ${path} appears ${inArchive.length} times in the archive`);
      return;
    }
    const entry = inArchive[0] as Record<string, unknown>;
    if (sizeOk && entry.byteLength !== byteLength) {
      errors.push(`${name}: byteLength is ${byteLength} in the manifest but ${JSON.stringify(entry.byteLength)} in the archive`);
    }
    if (hashOk && entry.sha256 !== sha256) {
      errors.push(`${name}: sha256 in the manifest does not match ${path} in the archive`);
    }
  });
  return ids;
}

function noteErrors(notes: unknown, attachmentIds: ReadonlySet<string>, errors: string[]): void {
  if (!Array.isArray(notes)) {
    errors.push('notes: must be an array');
    return;
  }
  const ids = new Set<string>();
  notes.forEach((note: unknown, index) => {
    if (!isRecord(note)) {
      errors.push(`notes[${index}]: must be an object`);
      return;
    }
    const { id, text } = note;
    const name = isNonEmptyString(id) ? `note "${id}"` : `notes[${index}]`;
    if (!isNonEmptyString(id)) errors.push(`${name}: id must be a non-empty string`);
    else if (ids.has(id)) errors.push(`${name}: duplicate id`);
    else ids.add(id);
    if (typeof text !== 'string') errors.push(`${name}: text must be a string`);
    if (note.attachmentIds === undefined) return;
    if (!Array.isArray(note.attachmentIds)) {
      errors.push(`${name}: attachmentIds must be an array of attachment ids`);
      return;
    }
    for (const attachmentId of note.attachmentIds as unknown[]) {
      if (typeof attachmentId !== 'string' || !attachmentIds.has(attachmentId)) {
        errors.push(`${name}: attachmentIds names unknown attachment ${JSON.stringify(attachmentId)}`);
      }
    }
  });
}

/**
 * Checks a parsed `manifest.json` against the entries of the archive it came from. A bundle of an
 * unknown format or major version is rejected without reading further; otherwise every problem found
 * is listed.
 */
export function validateVucoBundle(manifest: unknown, entries: readonly VucoBundleEntry[]): VucoBundleValidation {
  if (!isRecord(manifest)) return { ok: false, errors: ['manifest: must be a JSON object'] };
  const format = formatErrors(manifest);
  if (format.length > 0) return { ok: false, errors: format };

  const errors = headerErrors(manifest);
  const archive: readonly unknown[] = Array.isArray(entries) ? entries : [];
  if (!Array.isArray(entries)) errors.push('entries: must be an array of archive entries');
  const attachmentIds = attachmentErrors(manifest.attachments, archive, errors);
  noteErrors(manifest.notes, attachmentIds, errors);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest: manifest as unknown as VucoBundleManifest };
}
