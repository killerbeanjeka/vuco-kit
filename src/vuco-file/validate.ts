// Validates a `.vuco` manifest against the archive entries the caller read (Story 15.3). The kit never
// opens, writes, hashes or sends a bundle: the caller unzips it, parses manifest.json and passes each
// entry's path, size and SHA-256. Unknown manifest fields and archive entries no attachment names are
// ignored, so a 1.x bundle from a newer writer still validates.

import {
  SUPPORTED_FORMAT_MAJOR,
  VUCO_BUNDLE_FORMAT,
  VUCO_BUNDLE_PHOTO_TYPES,
  VUCO_BUNDLE_PHOTOS_DIR,
  VUCO_BUNDLE_PRODUCER_APP,
  type VucoBundleEntry,
  type VucoBundleManifest,
  type VucoBundlePhotoType,
  type VucoBundleValidation,
} from './types';

const FORMAT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// The kit's MAJOR.EPIC.STORY.BUILD rules (src/versioning/appVersion.mjs), kept here as a pattern so this
// TypeScript module does not import the Node helper: no leading zeros, and BUILD starts at 1.
const VERSION_NAME = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.([1-9]\d*)$/;
const KIND = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;
// A file directly under photos/, with a portable name that is not hidden and cannot climb out.
const FILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const MAX_FILE_NAME = 255;
const SHA256 = /^[0-9a-f]{64}$/;
const PHOTO_TYPES = Object.keys(VUCO_BUNDLE_PHOTO_TYPES) as VucoBundlePhotoType[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPhotoType(value: unknown): value is VucoBundlePhotoType {
  return typeof value === 'string' && (PHOTO_TYPES as string[]).includes(value);
}

function isVersionName(value: unknown): boolean {
  const match = typeof value === 'string' ? VERSION_NAME.exec(value) : null;
  return match !== null && match.slice(1).every((segment) => Number.isSafeInteger(Number(segment)));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** A date-time that exists: checked field by field, because engines roll impossible dates over. */
function isDateTime(value: unknown): boolean {
  const match = typeof value === 'string' ? DATE_TIME.exec(value) : null;
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetOk = match[7] === undefined || (Number(match[7]) <= 14 && Number(match[8]) <= 59);
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetOk
  );
}

/** Why `path` is not a usable attachment path, or null when it is. */
function photoPathProblem(path: unknown): string | null {
  if (typeof path !== 'string' || !path.startsWith(VUCO_BUNDLE_PHOTOS_DIR)) {
    return `must name a file directly under ${VUCO_BUNDLE_PHOTOS_DIR}`;
  }
  const name = path.slice(VUCO_BUNDLE_PHOTOS_DIR.length);
  if (!FILE_NAME.test(name)) return `must name a file directly under ${VUCO_BUNDLE_PHOTOS_DIR}`;
  if (name.length > MAX_FILE_NAME) return `has a file name longer than ${MAX_FILE_NAME} characters`;
  if (name.endsWith('.')) return 'has a file name that ends in a dot';
  return null;
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
    if (typeof producer.app !== 'string' || !VUCO_BUNDLE_PRODUCER_APP.test(producer.app)) {
      errors.push(
        `producer.app: must be "vuco" or "vuco:<name>" (a lowercase letter, then lowercase letters, digits and "-"), not ${JSON.stringify(producer.app)}`,
      );
    }
    if (!isVersionName(producer.version)) {
      errors.push(
        `producer.version: must be a MAJOR.EPIC.STORY.BUILD version name such as "0.2.0.1", not ${JSON.stringify(producer.version)}`,
      );
    }
  }
  if (typeof kind !== 'string' || !KIND.test(kind)) {
    errors.push(`kind: must be a lowercase kebab-case name such as "snag-list", not ${JSON.stringify(kind)}`);
  }
  if (!isDateTime(createdAt)) {
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
  // Lower-cased path → the path as written: two paths that differ only by letter case would overwrite
  // each other when the bundle is unpacked on a case-insensitive file system.
  const paths = new Map<string, string>();
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

    const pathProblem = photoPathProblem(path);
    const pathOk = pathProblem === null && typeof path === 'string';
    if (!pathOk) {
      errors.push(`${name}: path ${JSON.stringify(path)} ${pathProblem}`);
    } else {
      const earlier = paths.get(path.toLowerCase());
      if (earlier === path) errors.push(`${name}: duplicate path "${path}"`);
      else if (earlier !== undefined) errors.push(`${name}: path "${path}" differs from "${earlier}" only by letter case`);
      else paths.set(path.toLowerCase(), path);
    }
    if (!isPhotoType(mediaType)) {
      errors.push(`${name}: mediaType ${JSON.stringify(mediaType)} must be one of ${PHOTO_TYPES.join(', ')}`);
    } else if (pathOk) {
      const extensions: readonly string[] = VUCO_BUNDLE_PHOTO_TYPES[mediaType];
      if (!extensions.some((extension) => path.toLowerCase().endsWith(extension))) {
        errors.push(`${name}: path "${path}" must end in ${extensions.join(' or ')} for ${mediaType}`);
      }
    }
    const sizeOk = typeof byteLength === 'number' && Number.isSafeInteger(byteLength) && byteLength > 0;
    if (!sizeOk) errors.push(`${name}: byteLength must be a positive integer, not ${JSON.stringify(byteLength)}`);
    const hashOk = typeof sha256 === 'string' && SHA256.test(sha256);
    if (!hashOk) errors.push(`${name}: sha256 must be 64 lowercase hex digits`);
    if (!pathOk) return;

    // Entry names are compared exactly as the archive stores them (see README.md, "Validating").
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
    const listed = new Set<string>();
    for (const attachmentId of note.attachmentIds as unknown[]) {
      if (typeof attachmentId !== 'string' || !attachmentIds.has(attachmentId)) {
        errors.push(`${name}: attachmentIds names unknown attachment ${JSON.stringify(attachmentId)}`);
      } else if (listed.has(attachmentId)) {
        errors.push(`${name}: attachmentIds lists "${attachmentId}" more than once`);
      } else {
        listed.add(attachmentId);
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
