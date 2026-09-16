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

A file name uses only `A–Z a–z 0–9 . _ -` and does not start with a dot. The archive may hold other
entries; readers ignore any entry that no attachment names.

## `manifest.json`

| Field | Rule |
|---|---|
| `format` | Always `"vuco-bundle"`. |
| `formatVersion` | `"MAJOR.MINOR"`, e.g. `"1.0"`. |
| `producer.app` | The app that wrote the bundle: `"vuco"` or `"vuco:walk"`. |
| `producer.version` | That app's version name, e.g. `"0.2.0.1"`. |
| `kind` | What the bundle holds, as a lowercase kebab-case name, e.g. `"snag-list"`. |
| `createdAt` | When it was written: ISO 8601 with seconds and a time zone, e.g. `"2026-09-16T08:30:00Z"`. |
| `notes[]` | `id` (unique, non-empty), `text` (a string), and optional `attachmentIds` (ids from `attachments`). |
| `attachments[]` | `id` (unique, non-empty), `path` (`photos/<file name>`, unique), `mediaType` (`image/*`), `byteLength` (a positive integer), `sha256` (64 lowercase hex digits of the file's bytes). |

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

## Validating

The app unzips the archive, parses `manifest.json`, and lists every other entry with its path, size and
SHA-256. It then calls:

```ts
const result = validateVucoBundle(manifest, entries); // entries: { path, byteLength, sha256 }[]
if (!result.ok) {
  // result.errors: one line per problem, naming the field, note or attachment
}
```

The validator rejects:

- a `format` other than `vuco-bundle`, or an unsupported major version;
- a missing or malformed field from the table above;
- duplicate note ids, attachment ids or attachment paths;
- an attachment path outside `photos/`;
- an attachment the archive does not hold, holds twice, or holds with a different `byteLength` or
  `sha256`;
- a note that names an unknown attachment.

On success, `result.manifest` is the manifest, typed. A bundle is only as trustworthy as the entries the
caller measured, so compute each `sha256` from the bytes you read, not from the manifest.

## Fixtures

`createVucoBundleFixture()` returns a fresh valid bundle: a manifest with three notes and two tiny PNG
photos, the photo bytes, and the matching entries. The data is synthetic, and the digests are the real
SHA-256 of the bytes.
