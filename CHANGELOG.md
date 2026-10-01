# Changelog

## 0.7.0 — 2026-10-01

The dark treatment for vuco:walk Story 2.2: the item sheet and the Location sheet over the camera, which are
dark in both themes. Nothing under `tokens` or `config` changed.

Upgrading an app: nothing to do. Every new prop is optional, and outside the treatment every primitive renders
the classes it rendered before, except `ActionChip`'s label, which now shrinks to its row (a label that fits renders
as before). The new icon name adds to `IconName`, where every existing name stays.

- `src/ui/darkTreatment.tsx`: the `DarkTreatment` provider and `useDarkTreatment()`. Inside the provider,
  `Sheet`, `Input`, `ChoiceChip`, `ActionChip`, `OptionRow`, `ButtonPrimary` and `ButtonSecondary` show their
  dark-mode look in the `-dark` tokens alone (`DARK_TREATMENT`), whatever the app's theme: NativeWind's `dark:`
  follows one app-wide colour scheme, so it cannot darken a single surface. These strings are the kit's only
  single-mode classes, and the kit's `dark-pairing-allowlist.json` names this file with its reason; each
  primitive keeps its paired classes in its own file, where the check still reads them.
- `Sheet` takes `dark`, which puts its scrim and panel in the treatment and renders its children inside
  `DarkTreatment` (a sheet inside `DarkTreatment` is treated too), and `animationType`: `'slide'` by default,
  `'none'` on a surface where nothing animates.
- `ActionChip`'s `trailingIcon` takes `null`, which leaves the trailing icon out, for a chip that opens a field
  in place rather than a screen. Left out, it is still `chevron-right`.
- `ActionChip`'s label shrinks to the room its row leaves: a label too long for the row wraps inside the pill,
  where the trailing icon stays, instead of pushing that icon out of it (vuco:walk's location chip at font scale
  2.0). A label that fits renders as before.
- Icons: `calendar-outline` (a due date). The icon test checks that it is a MaterialCommunityIcons glyph and
  listed once.
- The pack guard in `kit-ci.yml` requires `src/ui/darkTreatment.tsx`.
- Tests cover each primitive in each of its coloured states inside and outside the treatment, `Sheet`'s `dark`
  and `animationType`, and `ActionChip` with its trailing icon left out, named and `null`.

## 0.6.0 — 2026-09-30

TalkBack labels and icon names for vuco:walk Story 1.9: the Location sheet, the delete's move step and
the selection bar. Nothing under `tokens` or `config` changed.

Upgrading an app: nothing to do. The new prop is optional and falls back to what the component read
before, and the new names add to `IconName`, where every existing name stays.

- `OptionRow` and `ActionChip` take an optional `accessibilityLabel`, read by screen readers in place of
  the visible `label` when given ("Kitchen, in Flat 4" for a row that shows "Kitchen"). Left out, they
  read `label`, as before.
- Icons: `arrow-right` (Move) and `content-copy` (Copy). The icon test checks that each is a
  MaterialCommunityIcons glyph and listed once.
- Tests cover both props, given and left out.

## 0.5.0 — 2026-09-29

Icon names for vuco:walk Story 1.5: the project menu and the Location editor. Only `ICON_NAMES` changed;
nothing under `tokens` or `config`, and no component, changed.

Upgrading an app: nothing to do. The new names add to `IconName`, and every existing name stays.

- Icons: `dots-vertical` (the project menu), `drag-horizontal-variant` (the reorder handle), `arrow-up` and
  `arrow-down` ("Move up" and "Move down"), and `delete-outline` (a row's delete action). The icon test
  checks that each is a MaterialCommunityIcons glyph and listed once.

## 0.4.0 — 2026-09-27

Kit release A (vuco:walk Story 1.1): what a second consumer needs before it pins the kit. Nothing
under `tokens` or `config` changed.

Upgrading an app:

- The pack validator reports more: a `pack.json` outside a two-letter pack folder, blank and `null`
  translations, and translations in languages `languages[]` does not declare. An object with a
  declared-language key and only text values now counts as a translation, so its other keys are
  reported. Run the validator on the app's packs before moving the pin.
- The floating + button is 64 dp (it rendered 56), and the tab-screen clearance grows by 76 dp: every
  screen that pads with `useBottomBarClearance()` scrolls further, and content centred in a view padded
  with it sits about 38 dp higher.
- `ExplainerCard`'s secondary link is 48 dp tall (it rendered 38.5), and `Sheet`'s backdrop label
  follows the app language.
- `collectTranslatedStrings(node, languages, path?, out?)` takes the pack's languages second and
  throws a `TypeError` without them.

- Consumer check: `kit-ci` installs the packed kit into a scratch app with every peer (at the kit's
  devDependency versions) and resolves every path the published docs name: the Node modules and the
  ESLint config load, TypeScript parses the base tsconfig, and every package the TypeScript sources
  import resolves (`test/consumer/scratchApp.mjs`, also a step-2 command in `CONTRIBUTING.md`).
  `test/consumer/documentedPaths.test.mjs` checks in `npm test` that every documented path is published.
- `CONTRIBUTING.md` step 6 names both consumers, vuco and vuco:walk, with their `apps/mobile` and
  `packs` folders and the DESIGN.md that carries each `kit:` line; `sync-kit` is vuco's alone.
- `validatePacks.mjs`:
  - a `pack.json` in a folder not named with two lowercase letters (`packs/AT/`, `packs/deu/`) fails
    the run and names the folder, instead of going unchecked; folders without one stay ignored;
  - a `pack.json` directly in the packs folder fails the run too, and a pack folder whose `pack.json`
    cannot be read is exit 2;
  - language coverage reports blank and `null` translations, and translations in a language
    `languages[]` does not declare, however the key is spelled (`EN`, `de-AT`, `en_GB`);
  - a translated string is an object of text values with a declared-language key, or one keyed only by
    lowercase tags of ISO 639-1 languages, so a map keyed by a country code that is no language
    (`{ at: …, ch: … }`) is data, while `{ en: … }` in a German-only pack is still reported; the README
    recommends uppercase ISO codes for per-country maps;
  - `collectTranslatedStrings(node, languages, path?, out?)` takes the pack's languages and throws a
    `TypeError` without them.
- `Sheet`'s backdrop label is the `kit` namespace's `close` ("Schließen" in German) instead of a fixed
  English "Close".
- `ExplainerCard`'s secondary link has a 48 dp touch target (`min-h-[48px]`). Its `min-h-11` was
  38.5 dp on devices, where NativeWind's rem is 14.
- Icons: `camera-outline`, `map-marker-outline`, `share-variant-outline`, `image-outline`, `undo` and
  `draw`. `ICON_NAMES` lists every name, `IconName` derives from it, and a test checks that each is a
  MaterialCommunityIcons glyph.
- `ScreenFooter` reports its occupied zone up to the top of the floating button (the bar, the 12 dp
  gap and the 64 dp button), so a tab screen's last row, right-aligned content included, scrolls clear
  of the button; the fallback clearance is 156 dp. The button is `h-[64px]`, the 64 px circle of the
  design: its `h-16` was 56 dp on devices, where NativeWind's rem is 14, so it grows by 8 dp.
- README: "Use in an app" documents the theme module and the font files; "Known gaps" is gone, both
  gaps closed.
- Tests cover each change.

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
