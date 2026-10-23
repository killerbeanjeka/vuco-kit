// Validates a `.vuco` manifest against the archive entries the caller read (Story 15.3; the 1.1 fields and
// the limits since kit 0.11.0). The kit never opens, writes, hashes or sends a bundle: the caller unzips
// it, parses manifest.json and passes each entry's path, size and SHA-256. Unknown manifest fields and
// archive entries no attachment names are ignored, so a 1.x bundle from a newer writer still validates.
// A 1.1 field is checked wherever it appears, whatever the minor version, and the limits hold for every
// 1.x bundle. The problem list is bounded: a value is echoed in at most MAX_SHOWN characters, a count over
// its limit stops the per-item checks, and past MAX_LINES lines the rest are only counted.

import {
  SUPPORTED_FORMAT_MAJOR,
  VUCO_BUNDLE_FORMAT,
  VUCO_BUNDLE_LIMITS,
  VUCO_BUNDLE_MANIFEST_PATH,
  VUCO_BUNDLE_PHOTO_TYPES,
  VUCO_BUNDLE_PHOTOS_DIR,
  VUCO_BUNDLE_PRIORITIES,
  VUCO_BUNDLE_PRODUCER_APP,
  VUCO_BUNDLE_STATUSES,
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
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
// RFC 9562: 8-4-4-4-12 lowercase hex digits, with a version from 1 to 8 and the variant bits 10.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LANGUAGE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
// A file directly under photos/, with a portable name that is not hidden and cannot climb out.
const FILE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const MAX_FILE_NAME = 255;
const SHA256 = /^[0-9a-f]{64}$/;
const PHOTO_TYPES = Object.keys(VUCO_BUNDLE_PHOTO_TYPES) as VucoBundlePhotoType[];
const LIMITS = VUCO_BUNDLE_LIMITS;
/** At most this many problem lines, then one line that counts the rest. */
const MAX_LINES = 100;
/** An echoed value takes at most this many characters, its cut marked with "…". */
const MAX_SHOWN = 80;

type Entry = Record<string, unknown>;

/** The problem lines of one validation: the first MAX_LINES kept, the rest only counted. */
class Problems {
  private readonly kept: string[] = [];
  private more = 0;

  push(line: string): void {
    if (this.kept.length < MAX_LINES) this.kept.push(line);
    else this.more += 1;
  }

  get length(): number {
    return this.kept.length + this.more;
  }

  lines(): string[] {
    if (this.more === 0) return this.kept;
    return [...this.kept, `… and ${this.more} more problem${this.more === 1 ? '' : 's'}`];
  }
}

/** `text` in at most MAX_SHOWN characters, its cut marked with "…". */
function clip(text: string): string {
  return text.length > MAX_SHOWN ? `${text.slice(0, MAX_SHOWN - 1)}…` : text;
}

/**
 * A value as a problem line echoes it: its JSON, clipped. A long string is cut before it is quoted, a value
 * JSON cannot write (too deep, circular) shows as […] or {…}, and NaN and Infinity show as themselves.
 */
function shown(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return clip(JSON.stringify(value.length > MAX_SHOWN ? value.slice(0, MAX_SHOWN) : value));
  try {
    return clip(JSON.stringify(value) ?? String(value));
  } catch {
    if (Array.isArray(value)) return '[…]';
    return value !== null && typeof value === 'object' ? '{…}' : clip(String(value));
  }
}

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

/** A day that exists: checked field by field, because engines roll impossible dates over. */
function isDay(year: number, month: number, day: number): boolean {
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

/** A date-time that exists, with seconds and a time zone. */
function isDateTime(value: unknown): boolean {
  const match = typeof value === 'string' ? DATE_TIME.exec(value) : null;
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const offsetOk = match[7] === undefined || (Number(match[7]) <= 14 && Number(match[8]) <= 59);
  return isDay(year, month, day) && hour <= 23 && minute <= 59 && second <= 59 && offsetOk;
}

/** A `YYYY-MM-DD` day that exists. */
function isDate(value: unknown): boolean {
  const match = typeof value === 'string' ? DATE.exec(value) : null;
  return match !== null && isDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

/**
 * `text`'s length in code points when that is over `limit`, else null. A code point takes one or two UTF-16
 * units; the count walks the units and builds nothing.
 */
function charsOver(text: string, limit: number): number | null {
  if (text.length <= limit) return null;
  let chars = 0;
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i += 1;
    }
    chars += 1;
  }
  return chars > limit ? chars : null;
}

/** Why `value` is not a usable name (the title, a trade, a location name), or null when it is. */
function nameProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return `must be a non-blank string, not ${shown(value)}`;
  const chars = charsOver(value, LIMITS.nameChars);
  return chars === null ? null : `is ${chars} characters long, over the limit of ${LIMITS.nameChars}`;
}

/** `"a", "b" or "c"`. */
function oneOf(values: readonly string[]): string {
  const quoted = values.map((value) => JSON.stringify(value));
  return `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`;
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
    errors.push(`format: must be "${VUCO_BUNDLE_FORMAT}", not ${shown(manifest.format)}`);
  }
  const version = typeof manifest.formatVersion === 'string' ? FORMAT_VERSION.exec(manifest.formatVersion) : null;
  if (!version) {
    errors.push(`formatVersion: must be "MAJOR.MINOR", not ${shown(manifest.formatVersion)}`);
  } else if (Number(version[1]) !== SUPPORTED_FORMAT_MAJOR) {
    errors.push(
      `formatVersion ${clip(version[0])}: major version ${clip(version[1])} is not supported; this reader reads ${SUPPORTED_FORMAT_MAJOR}.x`,
    );
  }
  return errors;
}

function headerErrors(manifest: Record<string, unknown>, errors: Problems): void {
  const { producer, kind, createdAt, bundleId, title, language } = manifest;
  if (!isRecord(producer)) {
    errors.push('producer: must be an object with app and version');
  } else {
    if (typeof producer.app !== 'string' || !VUCO_BUNDLE_PRODUCER_APP.test(producer.app)) {
      errors.push(
        `producer.app: must be "vuco" or "vuco:<name>" (a lowercase letter, then lowercase letters, digits and "-"), not ${shown(producer.app)}`,
      );
    }
    if (!isVersionName(producer.version)) {
      errors.push(`producer.version: must be a MAJOR.EPIC.STORY.BUILD version name such as "0.2.0.1", not ${shown(producer.version)}`);
    }
  }
  if (typeof kind !== 'string' || !KIND.test(kind)) {
    errors.push(`kind: must be a lowercase kebab-case name such as "snag-list", not ${shown(kind)}`);
  }
  if (!isDateTime(createdAt)) {
    errors.push(`createdAt: must be an ISO 8601 date-time with seconds and a time zone, not ${shown(createdAt)}`);
  }
  if (bundleId !== undefined && (typeof bundleId !== 'string' || !UUID.test(bundleId))) {
    errors.push(`bundleId: must be a lowercase RFC 9562 UUID (version 1 to 8, variant 10), not ${shown(bundleId)}`);
  }
  const titleProblem = title === undefined ? null : nameProblem(title);
  if (titleProblem !== null) errors.push(`title: ${titleProblem}`);
  if (language !== undefined && (typeof language !== 'string' || !LANGUAGE.test(language))) {
    errors.push(`language: must be a language code, "xx" or "xx-YY" such as "de" or "de-AT", not ${shown(language)}`);
  }
}

/** The archive entries by path, built once. An entry that is not an object or has no string path is left out. */
function indexEntries(entries: readonly unknown[]): Map<string, Entry[]> {
  const index = new Map<string, Entry[]>();
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.path !== 'string') continue;
    const listed = index.get(entry.path);
    if (listed) listed.push(entry);
    else index.set(entry.path, [entry]);
  }
  return index;
}

/** The count limits. Returns whether a count is over its limit, which stops the per-item checks. */
function countErrors(manifest: Record<string, unknown>, entries: readonly unknown[], errors: Problems): boolean {
  const { notes, attachments } = manifest;
  let over = false;
  if (Array.isArray(notes) && notes.length > LIMITS.notes) {
    errors.push(`notes: ${notes.length} notes, over the limit of ${LIMITS.notes}`);
    over = true;
  }
  if (Array.isArray(attachments) && attachments.length > LIMITS.attachments) {
    errors.push(`attachments: ${attachments.length} attachments, over the limit of ${LIMITS.attachments}`);
    over = true;
  }
  if (entries.length > LIMITS.entries) {
    errors.push(`entries: ${entries.length} archive entries, over the limit of ${LIMITS.entries}`);
    over = true;
  }
  return over;
}

/** `manifest.json` when the entries list it: once, and within its limit. */
function manifestEntryErrors(entries: readonly unknown[], errors: Problems): void {
  const listed = entries.filter((entry): entry is Entry => isRecord(entry) && entry.path === VUCO_BUNDLE_MANIFEST_PATH);
  if (listed.length > 1) errors.push(`${VUCO_BUNDLE_MANIFEST_PATH} appears ${listed.length} times in the archive`);
  for (const entry of listed) {
    const size = entry.byteLength;
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
      errors.push(`${VUCO_BUNDLE_MANIFEST_PATH}: byteLength in the archive must be a whole number of bytes, not ${shown(size)}`);
    } else if (size > LIMITS.manifestBytes) {
      errors.push(`${VUCO_BUNDLE_MANIFEST_PATH}: ${size} bytes in the archive, over the limit of ${LIMITS.manifestBytes}`);
    }
  }
}

/** Attachment shapes, uniqueness, the limits, and the match with the archive entries. Returns the known ids. */
function attachmentErrors(attachments: unknown, byPath: Map<string, Entry[]>, errors: Problems): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(attachments)) {
    errors.push('attachments: must be an array');
    return ids;
  }
  // Lower-cased path → the path as written: two paths that differ only by letter case would overwrite
  // each other when the bundle is unpacked on a case-insensitive file system.
  const paths = new Map<string, string>();
  let totalBytes = 0;
  attachments.forEach((attachment: unknown, index) => {
    if (!isRecord(attachment)) {
      errors.push(`attachments[${index}]: must be an object`);
      return;
    }
    const { id, path, mediaType, byteLength, sha256 } = attachment;
    const name = isNonEmptyString(id) ? `attachment ${shown(id)}` : `attachments[${index}]`;
    if (!isNonEmptyString(id)) errors.push(`${name}: id must be a non-empty string`);
    else if (ids.has(id)) errors.push(`${name}: duplicate id`);
    else ids.add(id);

    const pathProblem = photoPathProblem(path);
    const pathOk = pathProblem === null && typeof path === 'string';
    if (!pathOk) {
      errors.push(`${name}: path ${shown(path)} ${pathProblem}`);
    } else {
      const earlier = paths.get(path.toLowerCase());
      if (earlier === path) errors.push(`${name}: duplicate path ${shown(path)}`);
      else if (earlier !== undefined) errors.push(`${name}: path ${shown(path)} differs from ${shown(earlier)} only by letter case`);
      else paths.set(path.toLowerCase(), path);
    }
    if (!isPhotoType(mediaType)) {
      errors.push(`${name}: mediaType ${shown(mediaType)} must be one of ${PHOTO_TYPES.join(', ')}`);
    } else if (pathOk) {
      const extensions: readonly string[] = VUCO_BUNDLE_PHOTO_TYPES[mediaType];
      if (!extensions.some((extension) => path.toLowerCase().endsWith(extension))) {
        errors.push(`${name}: path ${shown(path)} must end in ${extensions.join(' or ')} for ${mediaType}`);
      }
    }
    const sizeOk = typeof byteLength === 'number' && Number.isSafeInteger(byteLength) && byteLength > 0;
    if (!sizeOk) errors.push(`${name}: byteLength must be a positive integer, not ${shown(byteLength)}`);
    else {
      totalBytes += byteLength;
      if (byteLength > LIMITS.attachmentBytes) {
        errors.push(`${name}: byteLength is ${byteLength}, over the limit of ${LIMITS.attachmentBytes}`);
      }
    }
    const hashOk = typeof sha256 === 'string' && SHA256.test(sha256);
    if (!hashOk) errors.push(`${name}: sha256 must be 64 lowercase hex digits`);
    if (!pathOk) return;

    // Entry names are compared exactly as the archive stores them (see README.md, "Validating").
    const inArchive = byPath.get(path) ?? [];
    if (inArchive.length === 0) {
      errors.push(`${name}: ${clip(path)} is missing from the archive`);
      return;
    }
    if (inArchive.length > 1) {
      errors.push(`${name}: ${clip(path)} appears ${inArchive.length} times in the archive`);
      return;
    }
    const entry = inArchive[0];
    if (sizeOk && entry.byteLength !== byteLength) {
      errors.push(`${name}: byteLength is ${byteLength} in the manifest but ${shown(entry.byteLength)} in the archive`);
    }
    if (hashOk && entry.sha256 !== sha256) {
      errors.push(`${name}: sha256 in the manifest does not match ${clip(path)} in the archive`);
    }
  });
  if (totalBytes > LIMITS.totalAttachmentBytes) {
    errors.push(`attachments: ${totalBytes} bytes in all, over the limit of ${LIMITS.totalAttachmentBytes}`);
  }
  return ids;
}

/** A note's `attachmentIds`, checked against the bundle's attachments. */
function noteAttachmentErrors(name: string, attachmentIds: unknown, known: ReadonlySet<string>, errors: Problems): void {
  if (attachmentIds === undefined) return;
  if (!Array.isArray(attachmentIds)) {
    errors.push(`${name}: attachmentIds must be an array of attachment ids`);
    return;
  }
  const listed = new Set<string>();
  for (const attachmentId of attachmentIds as unknown[]) {
    if (typeof attachmentId !== 'string' || !known.has(attachmentId)) {
      errors.push(`${name}: attachmentIds names unknown attachment ${shown(attachmentId)}`);
    } else if (listed.has(attachmentId)) {
      errors.push(`${name}: attachmentIds lists ${shown(attachmentId)} more than once`);
    } else {
      listed.add(attachmentId);
    }
  }
}

/**
 * A note's `photoPairs` (1.1): at least one pair; every one of the note's own `attachmentIds` in exactly
 * one pair; and each column filled from the first row, so a side is absent only after its column's last
 * photo.
 */
function photoPairErrors(name: string, photoPairs: unknown, own: readonly string[], errors: Problems): void {
  if (!Array.isArray(photoPairs)) {
    errors.push(`${name}: photoPairs must be an array of photo pairs`);
    return;
  }
  if (photoPairs.length === 0) {
    errors.push(`${name}: photoPairs must hold at least one pair`);
    return;
  }
  const ownIds = new Set(own);
  const used = new Set<string>();
  const columnEnded = { before: false, after: false };
  photoPairs.forEach((pair: unknown, index) => {
    const at = `photoPairs[${index}]`;
    if (!isRecord(pair) || (pair.before === undefined && pair.after === undefined)) {
      errors.push(`${name}: ${at} must be an object with a before photo, an after photo or both`);
      return;
    }
    for (const side of ['before', 'after'] as const) {
      const photoId = pair[side];
      if (photoId === undefined) {
        columnEnded[side] = true;
        continue;
      }
      if (columnEnded[side]) errors.push(`${name}: ${at}.${side} follows a row with no ${side} photo`);
      if (typeof photoId !== 'string') errors.push(`${name}: ${at}.${side} must be an attachment id, not ${shown(photoId)}`);
      else if (!ownIds.has(photoId)) errors.push(`${name}: ${at}.${side} ${shown(photoId)} is not one of the note's attachmentIds`);
      else if (used.has(photoId)) errors.push(`${name}: ${at}.${side} ${shown(photoId)} appears earlier in photoPairs`);
      else used.add(photoId);
    }
  });
  for (const id of ownIds) {
    if (!used.has(id)) errors.push(`${name}: photoPairs leaves out ${shown(id)}, one of the note's attachmentIds`);
  }
}

/** A note's 1.1 fields, each checked only when present. */
function snagFieldErrors(name: string, note: Record<string, unknown>, errors: Problems): void {
  const { location, trade, status, priority, dueDate, photoPairs } = note;
  if (location !== undefined) {
    if (!Array.isArray(location) || location.length === 0) {
      errors.push(`${name}: location must be an array of at least one location name, not ${shown(location)}`);
    } else if (location.length > LIMITS.locationLevels) {
      // Past the limit, only the count: each of a million levels would be a line.
      errors.push(`${name}: location has ${location.length} levels, over the limit of ${LIMITS.locationLevels}`);
    } else {
      location.forEach((level: unknown, index) => {
        const problem = nameProblem(level);
        if (problem !== null) errors.push(`${name}: location[${index}] ${problem}`);
      });
    }
  }
  const tradeProblem = trade === undefined ? null : nameProblem(trade);
  if (tradeProblem !== null) errors.push(`${name}: trade ${tradeProblem}`);
  if (status !== undefined && !(VUCO_BUNDLE_STATUSES as readonly unknown[]).includes(status)) {
    errors.push(`${name}: status must be ${oneOf(VUCO_BUNDLE_STATUSES)}, not ${shown(status)}`);
  }
  if (priority !== undefined && !(VUCO_BUNDLE_PRIORITIES as readonly unknown[]).includes(priority)) {
    errors.push(`${name}: priority must be ${oneOf(VUCO_BUNDLE_PRIORITIES)}, not ${shown(priority)}`);
  }
  if (dueDate !== undefined && !isDate(dueDate)) {
    errors.push(`${name}: dueDate must be a day that exists, as YYYY-MM-DD, not ${shown(dueDate)}`);
  }
  if (photoPairs !== undefined) {
    const own = Array.isArray(note.attachmentIds) ? note.attachmentIds.filter((id): id is string => typeof id === 'string') : [];
    photoPairErrors(name, photoPairs, own, errors);
  }
}

function noteErrors(notes: unknown, attachmentIds: ReadonlySet<string>, errors: Problems): void {
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
    const name = isNonEmptyString(id) ? `note ${shown(id)}` : `notes[${index}]`;
    if (!isNonEmptyString(id)) errors.push(`${name}: id must be a non-empty string`);
    else if (ids.has(id)) errors.push(`${name}: duplicate id`);
    else ids.add(id);
    if (typeof text !== 'string') {
      errors.push(`${name}: text must be a string`);
    } else {
      const chars = charsOver(text, LIMITS.noteTextChars);
      if (chars !== null) errors.push(`${name}: text is ${chars} characters long, over the limit of ${LIMITS.noteTextChars}`);
    }
    noteAttachmentErrors(name, note.attachmentIds, attachmentIds, errors);
    snagFieldErrors(name, note, errors);
  });
}

/**
 * Checks a parsed `manifest.json` against the entries of the archive it came from: every entry,
 * `manifest.json` included. A bundle of an unknown format or major version is rejected without reading
 * further. Otherwise every problem found is listed, one line each, up to MAX_LINES lines and a last line
 * counting the rest; a count over its limit lists the header and count lines without the per-item checks.
 */
export function validateVucoBundle(manifest: unknown, entries: readonly VucoBundleEntry[]): VucoBundleValidation {
  if (!isRecord(manifest)) return { ok: false, errors: ['manifest: must be a JSON object'] };
  const format = formatErrors(manifest);
  if (format.length > 0) return { ok: false, errors: format };

  const errors = new Problems();
  headerErrors(manifest, errors);
  const archive: readonly unknown[] = Array.isArray(entries) ? entries : [];
  if (!Array.isArray(entries)) errors.push('entries: must be an array of archive entries');
  const overCount = countErrors(manifest, archive, errors);
  manifestEntryErrors(archive, errors);
  if (!overCount) {
    const attachmentIds = attachmentErrors(manifest.attachments, indexEntries(archive), errors);
    noteErrors(manifest.notes, attachmentIds, errors);
  }
  return errors.length > 0 ? { ok: false, errors: errors.lines() } : { ok: true, manifest: manifest as unknown as VucoBundleManifest };
}
