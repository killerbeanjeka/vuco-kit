# `.vuco`: the hand-over bundle

A `.vuco` file carries one piece of work, its notes and its photos, from one vuco-family app to
another: for example, a vuco:walk snag list opened in vuco as a job. This folder holds the contract:
the types, the limits, a validator, a synthetic fixture and sample snag lists. Reading, writing,
hashing and sending files is the app's job; the kit does none of it and never uploads or transmits a
bundle (AD-14).

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
or `/`, and no backslashes. The archive has no ZIP64 records, no encryption and no link entries, and
every entry is stored or deflated: the photos stored (uncompressed), the manifest either way. Data
descriptors are allowed. Readers refuse anything else ("Reading a bundle safely").

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
| `formatVersion` | `"MAJOR.MINOR"`, e.g. `"1.1"`. A writer writes `VUCO_BUNDLE_FORMAT_VERSION`, `"1.1"`. |
| `producer.app` | The app that wrote the bundle: `"vuco"`, or `"vuco:<name>"` for any family app, where `<name>` starts with a lowercase letter and continues with lowercase letters, digits and `-` (`VUCO_BUNDLE_PRODUCER_APP`). |
| `producer.version` | That app's `MAJOR.EPIC.STORY.BUILD` version name, e.g. `"0.2.0.1"` (no leading zeros, BUILD at least 1). |
| `kind` | What the bundle holds, as a lowercase kebab-case name, e.g. `"snag-list"`. |
| `createdAt` | When it was written: an ISO 8601 date-time with seconds and a time zone, e.g. `"2026-09-16T08:30:00Z"`. It must exist: month 1–12, a day that month has (leap years included), hour at most 23, minutes and seconds at most 59, and an offset of at most ±14 hours. |
| `bundleId` | 1.1, optional. The hand-over's id: a lowercase RFC 9562 UUID (version 1 to 8, variant 10), such as a UUIDv7. A hand-over sent again carries the same content and keeps its id, so a reader can tell a repeat; changed content is a new hand-over with a new `bundleId`. |
| `title` | 1.1, optional. The name of the piece of work. |
| `language` | 1.1, optional. The language of the title, the notes, the trades and the location names: `xx` or `xx-YY`, e.g. `"de"` or `"de-AT"`. |
| `notes[]` | `id` (unique, non-empty), `text` (a string, which may be empty), and optional `attachmentIds`: ids from `attachments`, each listed at most once. 1.1 adds the optional fields below. |
| `notes[].location` | 1.1. Where the note applies: location names from the outermost level in, at least one, e.g. `["Flat 3", "Bathroom"]`. |
| `notes[].trade` | 1.1. The trade the work falls to, e.g. `"Tiling"`. |
| `notes[].status` | 1.1. `"open"` or `"closed"` (`VUCO_BUNDLE_STATUSES`). |
| `notes[].priority` | 1.1. `"high"`, `"medium"` or `"low"` (`VUCO_BUNDLE_PRIORITIES`). |
| `notes[].dueDate` | 1.1. The day the work is due: `YYYY-MM-DD`, a day that exists. |
| `notes[].photoPairs` | 1.1. The note's before and after photos side by side, oldest first: `[{ "before": <id>, "after": <id> }]`. It holds at least one pair, and every one of the note's own `attachmentIds` is in exactly one pair. Each column is filled from the first row, so a side is absent only after that column's last photo: a row where one column has run out has one side. A note without `photoPairs` does not say which of its photos are before and which after. |
| `attachments[]` | `id` (unique, non-empty); `path` (`photos/<file name>`, unique, following the file-name rules above); `mediaType` (one of the photo types below); `byteLength` (a positive integer); `sha256` (64 lowercase hex digits of the file's bytes). |

The title, a trade and a location name are never blank: each holds more than white space. An unset 1.1
field is left out, never written as `null`: the validator rejects `null` for every 1.1 field.

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
  "formatVersion": "1.1",
  "producer": { "app": "vuco:walk", "version": "0.6.6.1" },
  "kind": "snag-list",
  "createdAt": "2026-10-21T09:40:12Z",
  "bundleId": "01a15dd5-2602-7650-9f8e-0131f6dc3d41",
  "title": "Example House, Flat 3",
  "language": "en",
  "notes": [
    {
      "id": "01a15d7b-b6a7-7b2c-92f0-ab9c25490e4f",
      "text": "1. Cracked tile next to the shower tray\nFlat 3 › Bathroom › Shower › Back wall\nHairline crack across the second tile from the left.",
      "attachmentIds": ["01a15d7b-ec31-732a-a6dd-d0ac761e49e9"],
      "location": ["Flat 3", "Bathroom", "Shower", "Back wall"],
      "trade": "Tiling",
      "status": "open",
      "priority": "high",
      "dueDate": "2026-11-06",
      "photoPairs": [{ "before": "01a15d7b-ec31-732a-a6dd-d0ac761e49e9" }]
    }
  ],
  "attachments": [
    {
      "id": "01a15d7b-ec31-732a-a6dd-d0ac761e49e9",
      "path": "photos/01a15d7b-ec31-732a-a6dd-d0ac761e49e9.jpg",
      "mediaType": "image/jpeg",
      "byteLength": 160,
      "sha256": "6e020900d2de0a9cdcd29a1c8b7121e292bf12fd85680cd0deba13b399b5c730"
    }
  ]
}
```

## Limits

`VUCO_BUNDLE_LIMITS` holds for every 1.x bundle, 1.0 included. Each limit is inclusive: a bundle at
a limit is valid, one over it is not. Characters are Unicode code points: a code point outside the
Basic Multilingual Plane counts once, and an emoji made of several code points (a flag, a skin tone, a
joined sequence) counts each of them.

| What | Limit | Key |
|---|---|---|
| Notes | 10,000 | `notes` |
| Attachments | 20,000 | `attachments` |
| Archive entries, `manifest.json` included | 25,000 | `entries` |
| One attachment | 32 MiB (33,554,432 bytes) | `attachmentBytes` |
| All attachments together | 2,000,000,000 bytes | `totalAttachmentBytes` |
| `manifest.json` | 16 MiB (16,777,216 bytes), checked when the entries list it | `manifestBytes` |
| A note's text | 20,000 characters | `noteTextChars` |
| The title, a trade, a location name | 500 characters each | `nameChars` |
| Location levels | 10 | `locationLevels` |

## Versions

- A reader accepts every `1.x` bundle and ignores fields it does not know. A writer may add optional
  fields in a new minor version, but it never changes or removes a field, and never makes a new field
  required.
- 1.1 (kit 0.11.0) adds the optional `bundleId`, `title` and `language`, and the optional note fields
  `location`, `trade`, `status`, `priority`, `dueDate` and `photoPairs`. Every 1.0 field and rule
  stays. A 1.1 field is checked wherever it appears, in a bundle of any 1.x minor version, and the
  limits apply to every 1.x bundle.
- A field's rule never widens in a later 1.x minor version, since every reader of the major version
  would reject the wider value: a new status, priority or language form needs a new field, or format 2.
- Anything else is a new major version. `validateVucoBundle` rejects any major version other than
  `SUPPORTED_FORMAT_MAJOR` (1) and names it. It does not read the rest of such a bundle.
- The format accepts every family app as a producer. The app that imports a bundle decides which
  producers and which `kind`s it opens, and turns away the rest with its own message.

## Reading a bundle safely

A `.vuco` file comes from outside the app, so a reader trusts nothing in it until it has checked it.
It reads the archive by its central directory and checks, in this order:

1. **Before extracting anything,** from the central directory:
   - the number of entries against `entries`, and the declared size of `manifest.json` against
     `manifestBytes`;
   - no archive split over several disks, no ZIP64 records, no encryption, no link (a symbolic link
     entry), and no compression method other than stored and deflate;
   - no name listed twice, and no two names that differ only by letter case;
   - each entry's data ends before the central directory, and no two entries overlap;
   - names bounded in length: a name longer than the longest attachment path (`photos/` and 255
     characters) is not kept, since no attachment can name it.
2. **The manifest, read within its limit:** inflating stops at `manifestBytes`, and more fails the
   bundle. Its length and CRC-32 must be the central directory's, since no SHA-256 covers it. Then it
   parses the JSON and refuses the keys `__proto__`, `constructor` and `prototype`.
3. **The attachments, before any is written:** `attachments` holds at most
   `VUCO_BUNDLE_LIMITS.attachments` items, and no two name one path. Each entry an attachment names is
   checked against `attachmentBytes` by its declared size, and their total against
   `totalAttachmentBytes`. The device must have room for that total.
4. **Extraction of the attachments the manifest names, and nothing else, each named entry once:** into a
   fresh temporary folder, under a name the reader made itself or has checked against the file-name rules
   above, never along a path built from an entry name. Each local header's name and method must be the
   central directory's. Entries are streamed, never read whole into memory.
5. **Inflation stopped at the declared size:** an entry that inflates to more bytes, or fewer, fails
   the bundle.
6. **SHA-256 over the bytes written,** passed with every entry to `validateVucoBundle` (below).
7. **All or nothing:** on any failure the reader deletes the temporary folder, so a failure leaves
   nothing imported. Only a bundle that passes every step is imported.
8. **Before showing a photo:** its leading bytes must be those of its `mediaType`, and its declared
   dimensions must be sane, since a few kilobytes can decode to gigabytes. Alternatively, it is decoded
   with a decoder that bounds the pixel count.

Writers store photos uncompressed (the layout above), so a photo's stored size is its declared size.

## Validating

The app reads the archive as the section above says and parses `manifest.json`. It then lists every
entry of the archive, `manifest.json` included, with its path, size and SHA-256:

- **Path:** the entry name exactly as the archive stores it. Do not add, strip or rewrite anything:
  no removing a leading `./`, no turning backslashes into slashes, no changing letter case, no
  resolving `..`. The validator compares names as given, so an archive that stores `./photos/a.png`,
  `photos\a.png` or `photos/A.png` for the attachment `photos/a.png` is rejected as missing that
  attachment.
- **Size and SHA-256:** computed from the bytes the app actually read. An entry it did not read, one
  that no attachment names, goes in with its declared size and an empty `sha256`. `manifest.json`'s
  entry carries its size and its SHA-256, or an empty `sha256`, and only its size is checked. Every
  entry counts toward the `entries` limit, and only the entries attachments name have their size and
  digest compared.

It then calls:

```ts
const result = validateVucoBundle(manifest, entries); // entries: { path, byteLength, sha256 }[]
if (!result.ok) {
  // result.errors: one line per problem, naming the field, note or attachment
}
```

The list is bounded:
- it holds at most 100 lines, then one last line counting the rest (`… and 12 more problems`);
- a value a line echoes is cut to 80 characters, its cut marked with `…`;
- once a count (notes, attachments or entries) is over its limit, the list holds the header and count
  lines, without the per-item checks;
- past the location limit, a note's line gives the level count alone.

The validator rejects:

- a `format` other than `vuco-bundle`, or an unsupported major version;
- a missing or malformed field from the tables above, including:
  - a producer outside `vuco` / `vuco:<name>`, or a producer version that is not a version name;
  - a `createdAt` that does not exist;
  - a media type that is not a photo type, or a path whose extension does not match it;
- a malformed 1.1 field, in a bundle of any 1.x minor version:
  - a `bundleId` that is not a lowercase RFC 9562 UUID, or a `language` that is not `xx` or `xx-YY`;
  - a blank or non-string title, trade or location name, or a `location` with no names;
  - a `status` or `priority` outside its list, or a `dueDate` that is not a day that exists;
  - a photo pair with neither side, with an id that is not one of the note's `attachmentIds`, or with
    an id that an earlier pair of the note already uses;
  - `photoPairs` with no pair, that leave out one of the note's `attachmentIds`, or with a side after
    a row where that column ended;
  - `null` for any 1.1 field;
- anything over a limit, in a line that names the limit and the value;
- `manifest.json` listed more than once;
- duplicate note ids, attachment ids or attachment paths, and attachment paths that differ only by
  letter case;
- an attachment path outside `photos/`, a file name over 255 characters, or one ending in a dot;
- an attachment the archive does not hold, holds twice, or holds with a different `byteLength` or
  `sha256`;
- a note that names an unknown attachment, or names one attachment twice.

On success, `result.manifest` is the manifest, typed. A bundle is only as trustworthy as the entries the
caller measured, so compute each `sha256` from the bytes you read, not from the manifest.

## Fixtures

`createVucoBundleFixture()` returns a fresh valid 1.0 bundle: a manifest with three notes and two tiny
PNG photos, the photo bytes, and the matching entries. The data is synthetic, and the digests are the
real SHA-256 of the bytes.

## Samples

`createVucoSnagListSamples()` returns fresh 1.1 snag lists as vuco:walk writes them, each a valid
bundle with its photo bytes and the photos' entries (a `VucoBundleFixture`; a caller adds the entry of
`manifest.json`):

- `firstWalk`, in English: open items, each 1.1 note field at least once, a four-level location, a
  description over two lines, and two minimal notes with none of the 1.1 note fields (text and photos
  only). vuco:walk does not write minimal notes, but a reader must also accept them.
- `reinspected`, in German, after a finished re-inspection round: open and closed items, an item with
  two before photos and one after (so its second row has no after photo), an item with an after photo
  and no before, and an item added after the round.

As vuco:walk writes them:
- note and attachment ids are UUIDv7s, and each photo is a JPEG at `photos/<attachment id>.jpg`;
- every note carries `location` and `status`, and every note with photos carries `photoPairs`;
- a note's text is for display, and readers take the structured fields. Its first line is the item's
  `<number>. <title>`, or `<number>.` for an item without a title. Then come its location path joined by
  ` › `, and its description, which keeps its own line breaks. A line is left out when empty.

The data is synthetic: the photos are tiny valid JPEGs, and the digests are their real SHA-256. An app
that writes or reads bundles builds and tests against these samples and `VUCO_BUNDLE_LIMITS`.
