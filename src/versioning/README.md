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
  and no suffix.

## What the segments count

- **EPIC counts finished epics.** It is not the number an epic has in the planning documents (founder,
  2026-09-16). vuco finished its Epic 15 by moving from `0.1.10.2` to `0.2.0.1`.
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
`1.2.3.x`, and any kind other than `fix`, `story` or `epic` (`major` included).

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

## iOS accepts three segments

Android's `versionName` is a free string, so four segments are fine there. iOS rejects a
`CFBundleShortVersionString` with more than three integers. An iOS store build therefore uses the
first three segments (`MAJOR.EPIC.STORY`) and tells builds apart by its build number.
