# `.vuco`: the hand-over bundle

A `.vuco` file carries one piece of work, its notes and its photos, from one vuco-family app to
another: for example, a vuco:walk snag list opened in vuco as a job. This folder holds the contract:
the types, a validator and synthetic fixtures. Reading, writing, hashing and sending files is the
app's job; the kit does none of it and never uploads or transmits a bundle (AD-14).

```ts
import { validateVucoBundle } from '@vuco/kit/src/vuco-file';
```

## Archive layout (format version 1)

A `.vuco` file is a ZIP archive:

```
manifest.json          the manifest, at the archive root
photos/<file name>     one file per attachment, directly under photos/
```

A writer stores every entry name with forward slashes, relative to the archive root: no leading `./`
or `/`, and no backslashes.

A file name:
- uses only `A–Z a–z 0–9 . _ -`;
- does not start or end with a dot;
- has at most 255 characters;
- ends in the extension of its photo type.

No two attachment paths may differ only by letter case, because one would overwrite the other on a
case-insensitive file system. The archive may hold other entries; readers ignore any entry that no
attachment names.

## `manifest.json`

| Field | Rule |
|---|---|
| `format` | Always `"vuco-bundle"`. |
| `formatVersion` | `"MAJOR.MINOR"`, e.g. `"1.0"`. |
| `producer.app` | The app that wrote the bundle: `"vuco"`, or `"vuco:<name>"` for any family app, where `<name>` starts with a lowercase letter and continues with lowercase letters, digits and `-` (`VUCO_BUNDLE_PRODUCER_APP`). |
| `producer.version` | That app's `MAJOR.EPIC.STORY.BUILD` version name, e.g. `"0.2.0.1"` (no leading zeros, BUILD at least 1). |
| `kind` | What the bundle holds, as a lowercase kebab-case name, e.g. `"snag-list"`. |
| `createdAt` | When it was written: an ISO 8601 date-time with seconds and a time zone, e.g. `"2026-09-16T08:30:00Z"`. It must exist: month 1–12, a day that month has (leap years included), hour at most 23, minutes and seconds at most 59, and an offset of at most ±14 hours. |
| `notes[]` | `id` (unique, non-empty), `text` (a string), and optional `attachmentIds`: ids from `attachments`, each listed at most once. |
| `attachments[]` | `id` (unique, non-empty); `path` (`photos/<file name>`, unique, following the file-name rules above); `mediaType` (one of the photo types below); `byteLength` (a positive integer); `sha256` (64 lowercase hex digits of the file's bytes). |

Photo types (`VUCO_BUNDLE_PHOTO_TYPES`), with the extensions each allows, compared ignoring letter
case:

| `mediaType` | Extensions |
|---|---|
| `image/jpeg` | `.jpg`, `.jpeg` |
| `image/png` | `.png` |
| `image/heic` | `.heic` |
| `image/webp` | `.webp` |

A bundle carries photos only. Other image types, SVG among them (it can carry script), are rejected.

```json
{
  "format": "vuco-bundle",
  "formatVersion": "1.0",
  "producer": { "app": "vuco:walk", "version": "0.1.0.1" },
  "kind": "snag-list",
  "createdAt": "2026-09-16T08:30:00Z",
  "notes": [{ "id": "note-1", "text": "Cracked tile next to the shower tray", "attachmentIds": ["photo-1"] }],
  "attachments": [
    { "id": "photo-1", "path": "photos/snag-1.png", "mediaType": "image/png", "byteLength": 67, "sha256": "<64 hex digits>" }
  ]
}
```

## Versions

- A reader accepts every `1.x` bundle and ignores fields it does not know. A writer may add optional
  fields in a new minor version, but it never changes or removes a field, and never makes a new field
  required.
- Anything else is a new major version. `validateVucoBundle` rejects any major version other than
  `SUPPORTED_FORMAT_MAJOR` (1) and names it. It does not read the rest of such a bundle.
- The format accepts every family app as a producer. The app that imports a bundle decides which
  producers and which `kind`s it opens, and turns away the rest with its own message.

## Validating

The app unzips the archive and parses `manifest.json`. It then lists every other entry with its path,
size and SHA-256:

- **Path:** the entry name exactly as the archive stores it. Do not add, strip or rewrite anything:
  no removing a leading `./`, no turning backslashes into slashes, no changing letter case, no
  resolving `..`. The validator compares names as given, so an archive that stores `./photos/a.png`,
  `photos\a.png` or `photos/A.png` for the attachment `photos/a.png` is rejected as missing that
  attachment.
- **Size and SHA-256:** computed from the bytes the app actually read.

It then calls:

```ts
const result = validateVucoBundle(manifest, entries); // entries: { path, byteLength, sha256 }[]
if (!result.ok) {
  // result.errors: one line per problem, naming the field, note or attachment
}
```

The validator rejects:

- a `format` other than `vuco-bundle`, or an unsupported major version;
- a missing or malformed field from the tables above, including:
  - a producer outside `vuco` / `vuco:<name>`, or a producer version that is not a version name;
  - a `createdAt` that does not exist;
  - a media type that is not a photo type, or a path whose extension does not match it;
- duplicate note ids, attachment ids or attachment paths, and attachment paths that differ only by
  letter case;
- an attachment path outside `photos/`, a file name over 255 characters, or one ending in a dot;
- an attachment the archive does not hold, holds twice, or holds with a different `byteLength` or
  `sha256`;
- a note that names an unknown attachment, or names one attachment twice.

On success, `result.manifest` is the manifest, typed. A bundle is only as trustworthy as the entries the
caller measured, so compute each `sha256` from the bytes you read, not from the manifest.

## Fixtures

`createVucoBundleFixture()` returns a fresh valid bundle: a manifest with three notes and two tiny PNG
photos, the photo bytes, and the matching entries. The data is synthetic, and the digests are the real
SHA-256 of the bytes.
