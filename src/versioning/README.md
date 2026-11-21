# App versions: `MAJOR.EPIC.STORY.BUILD`

Every vuco-family app names its builds `MAJOR.EPIC.STORY.BUILD`, for example `0.2.0.1`. The scheme is
shared; the numbers are not, because each app counts its own epics and stories. The kit itself is not an
app: it uses semver tags (`CONTRIBUTING.md`).

## Rules

- The version name changes in the commit that makes the change, never later.
- A fix: BUILD + 1. `0.1.10.2` → `0.1.10.3`.
- A finished story: STORY + 1, BUILD = 1. `0.1.10.2` → `0.1.11.1`.
- A finished epic: EPIC + 1, STORY = 0, BUILD = 1. `0.1.10.2` → `0.2.0.1`. When one commit finishes a
  story and its epic, the epic bump applies.
- MAJOR belongs to the app's owner. No script raises it; the owner edits it by hand.
- A version name is four non-negative integers without leading zeros, and nothing else: no `v` prefix
  and no suffix. BUILD is at least 1; MAJOR, EPIC and STORY may be 0.

## What the segments count

- **EPIC counts the epics finished since the app adopted this scheme.** It is not the number an epic has
  in the planning documents (founder, 2026-09-16), and epics finished before the scheme do not count.
  vuco adopted the scheme on 2026-08-06 at `0.1.1.1`, and finishing its Epic 15 moved it from
  `0.1.10.2` to `0.2.0.1`.
- **STORY** counts the stories finished since the last epic bump.
- **BUILD** starts at 1 with every story or epic bump and goes up by one with every fix after it.

## The helper

`appVersion.mjs` is plain ESM, so an app's Node scripts import it straight from `node_modules`:

```js
import { bumpAppVersion, formatAppVersion, parseAppVersion } from '@vuco/kit/src/versioning/appVersion.mjs';

bumpAppVersion('0.1.10.2', 'fix'); // '0.1.10.3'
bumpAppVersion('0.1.10.2', 'story'); // '0.1.11.1'
bumpAppVersion('0.1.10.2', 'epic'); // '0.2.0.1'
parseAppVersion('0.1.10.2'); // { major: 0, epic: 1, story: 10, build: 2 }
formatAppVersion({ major: 0, epic: 2, story: 0, build: 1 }); // '0.2.0.1'
```

Each function throws on input it does not recognise and names it: `0.1.10`, `0.01.1.1`, `v0.1.1.1`,
`1.2.3.x`, a BUILD of `0` (`0.1.1.0`), and any kind other than `fix`, `story` or `epic` (`major` included).

An app wraps the helper in a script that rewrites only the version value in its app config and leaves
every other byte alone. In vuco that is `npm run bump -- <fix|story|epic>` in `apps/mobile`
(`scripts/bump-version.mjs`), which exits 2 and writes nothing when the helper throws.

## Build numbers belong to EAS, one counter per app

The version name is what people read: the store's release row, a tester's store listing, the version
line in a feedback email. The store build number is a separate integer (Android `versionCode`, iOS
`buildNumber`). Each app's `eas.json` sets `"appVersionSource": "remote"` and `"autoIncrement": true`,
so EAS raises it on every store build. EAS keeps that counter per project: two apps never share build
numbers, only this scheme. The helper never touches a build number, and EAS never touches the version
name.

## iOS: STORY and BUILD share the third number

Android's `versionName` is a free string, so four segments are fine there. iOS rejects a
`CFBundleShortVersionString` with more than three integers. An iOS build is therefore named
`MAJOR.EPIC.(STORY × 1000 + BUILD)` (founder, 2026-11-21):

| App version | iOS version name |
| ----------- | ---------------- |
| `0.3.1.4`   | `0.3.1004`       |
| `0.3.2.1`   | `0.3.2001`       |
| `0.4.0.1`   | `0.4.1`          |

```js
import { iosVersionName } from '@vuco/kit/src/versioning/appVersion.mjs';

iosVersionName('0.3.1.4'); // '0.3.1004'
```

To read an iOS name back: STORY is the third number divided by 1000 and rounded down, and BUILD is
the remainder. `0.3.1004` is story 1, build 4; `0.4.1` is story 0, build 1.

- Every version has its own iOS name, and the names sort as the versions do, because BUILD stays
  below 1000 (`IOS_BUILD_BOUND`). `iosVersionName` throws for a BUILD of 1000 or more and for
  anything `parseAppVersion` refuses. It has no fallback name.
- `bumpAppVersion` does not know the bound: a `fix` bump of BUILD 999 returns BUILD 1000, which has
  no iOS name. What an app does then is its owner's call; a story or epic bump resets BUILD.
- The four-part name stays the app's one version. The app config holds it once, as `version`, and the
  bump script is unchanged. An app derives the iOS name where its config is built: in Expo, a dynamic
  config (`app.config.js`) sets `ios.version` to `iosVersionName(config.version)`. Prebuild writes
  `ios.version` into the iOS Info.plist in place of `version`, so Android keeps the four segments.
  EAS itself reads `version` only: its build page shows the four-part name for an iOS build too, and
  EAS CLI warns about it on every iOS build.
- Expo's `app.config.js` is CommonJS, so it loads the helper with `require()`:
  `const { iosVersionName } = require('@vuco/kit/src/versioning/appVersion.mjs');`. Node can
  `require()` an ESM file from 22.12 on; an older Node stops with `ERR_REQUIRE_ESM`.
- The iOS build number (`CFBundleVersion`) is still EAS's counter, as on Android.
