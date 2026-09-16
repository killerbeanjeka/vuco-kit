# Changelog

## 0.3.1 — 2026-09-16

Review fixes for the 0.3.0 family contracts (vuco Story 15.3 review), including two founder decisions
that change the `.vuco` v1 rules before any app reads or writes a bundle. Nothing under `src/ui`,
`src/i18n`, `config` or `tokens` changed.

- `.vuco` (founder decisions):
  - `mediaType` must be a photo type: `image/jpeg`, `image/png`, `image/heic` or `image/webp`. The
    path's extension must match it, ignoring letter case (`.jpg`/`.jpeg`, `.png`, `.heic`, `.webp`).
    `VUCO_BUNDLE_PHOTO_TYPES` lists them, and `VucoBundleAttachment.mediaType` is their union. SVG and
    other image types are rejected.
  - `producer.app` accepts `vuco` or `vuco:<name>` (`VUCO_BUNDLE_PRODUCER_APP`,
    `^vuco(?::[a-z][a-z0-9-]*)?$`), so a later family app's 1.x bundle is not refused. This replaces
    `VUCO_BUNDLE_PRODUCERS`. The importing app decides which producers and kinds it opens.
- `.vuco` validator:
  - `producer.version` must be a `MAJOR.EPIC.STORY.BUILD` version name;
  - `createdAt` must be a date-time that exists, checked field by field (leap years, hour 23 at most,
    offset ±14 hours at most) rather than through `Date.parse`;
  - attachment paths that differ only by letter case, file names over 255 characters or ending in a
    dot, and a note listing one attachment twice are rejected.
  - The README says how to build `entries`: entry names exactly as stored, compared as given.
- `countryLiteralLint.mjs`:
  - country codes, pack ids and locales are found between `"`, `'` or backticks, the same quote on both
    sides, so `.ts` scans catch single-quoted and template literals (`.cs` results are unchanged);
  - a file or folder under `--root` that cannot be read exits 2 ("cannot scan …") instead of
    rejecting;
  - a `--packs` folder without a two-letter pack folder, or a `--tokens` module that returns no
    tokens, exits 2 instead of silently switching a class off;
  - every printed path is relative to `--repo-root` (in full outside it), not to the working
    directory.
- `validatePacks.mjs`:
  - an app check that throws or returns anything but a list of lines returns 2, naming the pack;
  - `version`, `schemaVersion` and `languages[]` are checked, whatever the app schema requires;
  - the injected ajv is typed loosely, so the README example type-checks without a cast, and checked
    when the validator runs (a namespace import works too).
  - A test pins `strict: true`.
- `appVersion.mjs`: BUILD 0 is rejected; the policy says EPIC counts the epics finished since an app
  adopted the scheme (vuco: 2026-08-06, `0.1.1.1`).
- README: "Known gaps" discloses Sheet's English "Close" label and ExplainerCard's 44 dp secondary link.
- `kit-ci` fails when a file under `src/` outside `src/ui/` contains `className`.
- Tests cover each fix.

## 0.3.0 — 2026-09-16

The family contracts: the generic core of vuco's pack tooling (imported from vuco at commit
`ad3e3e32668f41e51c069a8492e933b32d1154e0`), the app version helper, and the `.vuco` hand-over
bundle. Nothing under `src/ui`, `src/i18n`, `config` or `tokens` changed.

- `src/packs/validatePacks.mjs`: `runPackValidation({ packsDir, schemaFile, ajv, checks })` validates
  every `<packsDir>/<id>/pack.json` against the app's JSON Schema, checks that `packId` matches the
  folder and that every translated string covers every language in `languages[]`, runs the app's own
  checks, prints vuco's report lines, and returns 0, 1, or 2 when the schema or the folder cannot be
  read. The caller passes in ajv 8 and ajv-formats 3; the kit sets JSON Schema 2020-12, `strict`,
  `allErrors` and formats. The success line no longer counts mandatory fields, and a pack whose
  `languages` is not a list of two-letter codes now fails instead of passing the coverage check on
  nothing. Also exported: `collectTranslatedStrings` and `languageCoverageProblems`.
- `src/packs/countryLiteralLint.mjs`: the engine of vuco's pack lint as a CLI and as `main(argv)`.
  `--root` and `--ext` are required; `--allowlist`, `--repo-root` (default: the working directory),
  `--packs` (the pack ids) and `--tokens` (a module whose default export returns
  `[{ token, spellings }]`) are optional. The three classes, the full ISO 3166-1 alpha-2 and alpha-3
  sets, lowercase pack ids, the report lines and the exit codes are vuco's. The walk skips `bin`, `obj`
  and `node_modules` and runs in name order. New: an unknown or repeated flag, an unreadable `--root`,
  `--packs` or `--tokens`, and an allowlist that exists but cannot be read exit 2 (a missing allowlist
  still means no exemptions).
- `src/packs/packCopy.ts`: `packCopyMismatches(pack, copy, pairs)` and `assertPackCopy(...)` compare a
  checked-in copy of pack data with its pack. Pairs map dot paths, with `name[field=value]` selectors,
  by deep JSON equality, and a mismatch names the first place inside the value where the two differ.
  An unresolvable path or a selector that matches no element or several is a mismatch, and an empty
  pair list throws.
- `src/versioning/appVersion.mjs`: `parseAppVersion`, `formatAppVersion`, `bumpAppVersion(text, kind)`
  and `BUMP_KINDS` for `MAJOR.EPIC.STORY.BUILD`. Anything but four integers without leading zeros, and
  any kind but `fix`, `story` or `epic`, throws and names the input. `README.md` holds the policy: the
  rules, EPIC counting finished epics, EAS build numbers per app, and the iOS three-segment limit.
- `src/vuco-file/`: format version 1 of the `.vuco` bundle, a ZIP file with `manifest.json` at the root
  and the photos under `photos/`. `types.ts` (manifest types, `SUPPORTED_FORMAT_MAJOR = 1`),
  `validate.ts` (`validateVucoBundle(manifest, entries)`), `fixtures.ts`
  (`createVucoBundleFixture()`: two synthetic 67-byte PNGs, their real SHA-256, a valid manifest and its
  entries), `index.ts`, and `README.md` (layout, fields, versioning). The kit reads, writes, hashes and
  sends no file.
- Tests: node:test suites for the validator, the lint and the version helper; Jest suites for the drift
  helper and the bundle validator, including proof that the fixture digests are real. Each kit-side row
  of the story's I/O matrix has a test.
- `package.json`: the optional `eslint` peer is `^9.22.0`, the first version that exports
  `eslint/config`, which `config/eslint.base.js` requires. New devDependencies `ajv` 8.17.1 and
  `ajv-formats` 3.0.1; still no `dependencies`.
- `tsconfig.json` type-checks `src/**/*.mjs` and `test/**/*.mjs`. The `kit-ci` pack guard requires and
  allows the new files.
- Docs. README: consumers scan only `src/ui/**` for Tailwind classes, and styled components live only
  there (update the app's `content` glob with this bump); the Jest mocks kit source needs; the React
  Compiler skips kit files; new sections "Primitive contracts" and "Family contracts". AGENTS.md: the
  UI primitive rules, the new kit paths, and what EPIC counts. CONTRIBUTING: a consumer bump installs
  the tag explicitly, in vuco's `apps/mobile` and `packs`, and checks the installed version and the
  commit the lockfile resolves.

## 0.2.0 — 2026-09-15

UI primitives, the i18n setup and the base lint and TypeScript configs, imported from vuco at commit
`969cc7ce462e24071caab153f772f01875f54995`.

- `src/ui/`: `ActionChip`, `ActionRow`, `Banner`, `ButtonPrimary`, `ButtonSecondary`, `ChoiceChip`,
  `ExplainerCard`, `Input`, `OptionRow`, `ScreenFooter`, `ScreenHeader`, `SegmentedTabs`, `Sheet`,
  `icons` and `bottomBarSpace`, unchanged apart from two seams:
  - `ScreenFooter` takes `items` (route name, icon, translated label) and `primaryAction` (label,
    `onPress`) instead of vuco's tabs and its New-job route; the 600 ms re-entrancy guard, testIDs
    and classes stay.
  - `ScreenHeader` reads its back and close labels from the kit's `kit` namespace.
- `src/i18n/`: `createI18n({ resources, fallbackLng })` initialises the default i18next instance —
  Hermes plural-rules polyfills, device language, fallback — with the app's strings as `translation`
  and the kit's (`en`, `de`) as `kit`, and returns it; `deviceBestMatchLanguage()`.
- `config/eslint.base.js` (Expo's flat config, `dist/*` ignored) and `config/tsconfig.base.json`
  (`expo/tsconfig.base`, `strict`, Jest types).
- Consumers import kit files by path: `@vuco/kit/src/ui/<Name>`, `@vuco/kit/src/i18n`,
  `@vuco/kit/config/*`. There is no root barrel and no `exports` map. `peerDependencies` name the
  packages the source imports, at vuco's specifiers, except `react` (`~19.2.3`) and `react-native`
  (`~0.86.0`), which take tilde ranges so an Expo SDK 57 patch in a consumer does not fail
  `npm install`; `eslint`, `eslint-config-expo`, `expo`, `typescript` and `@types/jest` are optional
  peers that only `config/*` needs.
- Tooling: Jest suites (jest-expo, NativeWind JSX) for the primitives and the i18n factory, on a
  lockfile seeded from vuco's; typecheck and lint cover the TSX source and its tests. `npm test` runs
  `node --test "test/**/*.test.mjs"` and then Jest — a bare `node --test` would also collect the
  TypeScript Jest suites now that Node strips types. `kit-ci` runs the dark-pairing check over `src`,
  and its pack guard fails when a `src` or `config` file is missing or anything outside the published
  layout ships, tests included.
- `tokens/generate-tokens.mjs` exits 2 on an unknown argument, so a typo such as `--chek` can no
  longer run write mode and pass the staleness gate.
- `mergeBrand` accepts only a non-empty string in a brand slot, and `#RRGGBB` in colour slots;
  anything else exits 2 naming the key.
- Tests: `--check` exits 1 and names the stale output; every generator run that can write happens in
  a throw-away copy under the git-ignored `.test-tmp/`, so an interrupted run leaves nothing
  trackable in `tokens/`.
- `tokens/check-dark-pairing.mjs` exits 2 when `--src` holds no `.tsx` files; its hint points at the
  allowlist file.
- `kit-ci` also runs on `v*` tags and checks that a tag is `v` + the `package.json` version, that
  `package.json` defines no install-time scripts, that `npm pack` lists the five fonts, `OFL.txt` and
  `tokens/out/vuco/*`, and that the whole tree is unchanged at the end.
- `package.json`: `engines.node` is `>=22`.
- README no longer hard-codes a version. CONTRIBUTING: push `master`, wait for a green `kit-ci`, then
  push the tag; a consumer bump also updates DESIGN.md's `kit:` pin and, when landing copies change,
  the landing `?v=` tokens.

## 0.1.0 — 2026-09-15

First release: design tokens and fonts, imported from vuco at commit
`c0606c9ee2774e08e5dfdc530e31633e7308a46e`.

- Token source split into the shared `tokens/base.tokens.yaml` (brand-owned slots are `null`) and
  `tokens/brands/vuco.yaml`.
- `tokens/generate-tokens.mjs` requires `--brand <name>`, writes `tokens/out/<name>/`, and exports
  `mergeBrand`. A base slot the brand leaves empty, or a brand key with no slot, exits 2 and
  writes nothing. The vuco outputs are byte-identical to vuco's from line 3 on; header lines 1–2
  now name the kit sources.
- `tokens/check-dark-pairing.mjs` is a CLI (`--src`, `--allowlist`, `--theme`) and now also covers
  the tokens whose theme keys are unquoted (`primary`, `link`, `accent`).
- Plus Jakarta Sans 2.7.1 (five static weights) with `OFL.txt`; tabular figures verified by
  `tokens/check-tnum.mjs`.
