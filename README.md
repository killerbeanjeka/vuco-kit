# @vuco/kit

The shared layer of the vuco app family: the design tokens, their generator and checks, the fonts,
the UI primitives, the i18n setup, the base lint and TypeScript configs, and the family contracts
(pack tooling, the `.vuco` hand-over bundle, the app version helper).

Consumers depend on a release tag of this public repository — no registry, no credentials, no
install scripts:

```json
"@vuco/kit": "github:killerbeanjeka/vuco-kit#vX.Y.Z"
```

Releases are the repository's `vX.Y.Z` tags; [CHANGELOG.md](CHANGELOG.md) says what each one changed.

## Contents

| Path | What |
|---|---|
| `tokens/base.tokens.yaml` | Shared tokens: colours (light and `-dark`), typography roles, radii, spacing, component tokens. `null` marks a brand-owned slot. |
| `tokens/brands/<brand>.yaml` | One brand: fills every `null` slot of the base and nothing else. |
| `tokens/generate-tokens.mjs` | `--brand <name>` writes `tokens/out/<name>/`; `--check` is the staleness gate. |
| `tokens/out/vuco/` | Committed vuco outputs: NativeWind theme, Hosted Page CSS, QuestPDF C# class. |
| `tokens/fonts/` | Plus Jakarta Sans 2.7.1, five static weights, SIL OFL 1.1 (`OFL.txt`). |
| `tokens/check-tnum.mjs` | Verifies tabular figures for the money role; writes `font-verdict.json`. |
| `tokens/check-dark-pairing.mjs` | CLI for consumers: every dual-mode colour token is used with its `-dark` twin. |
| `src/ui/<Name>.tsx` | The cross-app UI primitives — `ButtonPrimary`, `ButtonSecondary`, `Input`, `Sheet`, `OptionRow`, `ActionRow`, `ActionChip`, `ChoiceChip`, `Banner`, `ScreenHeader`, `ScreenFooter`, `SegmentedTabs`, `ExplainerCard`, `icons`, `bottomBarSpace` — as TypeScript source styled with the token classes. Contracts: [below](#primitive-contracts). |
| `src/i18n/` | `createI18n({ resources, fallbackLng })` and `deviceBestMatchLanguage()`; `en.json` and `de.json` hold the kit's own words (the `kit` namespace: ScreenHeader's back and close labels). Sheet's backdrop still has a fixed English "Close" accessibility label, a known gap. |
| `src/packs/` | Pack tooling: `validatePacks.mjs` (schema and language-coverage validator), `countryLiteralLint.mjs` (the country-literal lint CLI), `packCopy.ts` (the drift check for a checked-in copy of pack data). No schema, no data. |
| `src/versioning/` | `appVersion.mjs`: parse and bump the `MAJOR.EPIC.STORY.BUILD` app version. The policy: [src/versioning/README.md](src/versioning/README.md). |
| `src/vuco-file/` | The `.vuco` hand-over bundle: manifest types, a validator and synthetic fixtures. The format: [src/vuco-file/README.md](src/vuco-file/README.md). |
| `config/eslint.base.js` | The ESLint flat config apps extend: Expo's, with `dist/*` ignored. |
| `config/tsconfig.base.json` | The TypeScript base apps extend: `expo/tsconfig.base`, `strict`, Jest types. |
| `AGENTS.md` | Conventions every consumer app follows. |

Details: [tokens/README.md](tokens/README.md).

## Use in an app

The kit ships source, not a build, and has no root barrel and no `exports` map: an app imports each
file by its path.

```ts
import { ButtonPrimary } from '@vuco/kit/src/ui/ButtonPrimary';
import { createI18n } from '@vuco/kit/src/i18n';
```

An app that already has these files keeps its import paths by turning each old file into a one-line
re-export, `export * from '@vuco/kit/src/ui/<Name>';`. It carries every named export — constants,
hooks and types included. `export *` never re-exports a default export, and kit files have none.

The app provides the peer dependencies at the versions in `package.json` (the Expo SDK 57 set). The
optional ones — `eslint`, `eslint-config-expo`, `expo`, `typescript`, `@types/jest` — are what
`config/*` needs; an app that does not extend the configs can leave them out. The app wires the kit
in five places:

- **NativeWind** — `tailwind.config.js` scans the kit's `src/ui/` as well, or every class that only
  kit source uses renders unstyled, with no error:
  `content: ['./src/**/*.{ts,tsx}', './node_modules/@vuco/kit/src/ui/**/*.{ts,tsx}']`.
  Every styled kit component lives under `src/ui/`, the only kit folder consumers scan for classes.
  Scan nothing else: the other folders hold plain strings that Tailwind would read as classes, and
  that would change the app's CSS. The glob assumes the kit at `./node_modules/@vuco/kit`, npm's
  layout for an app with its own `node_modules`; where a workspace hoists the kit, build the glob
  from `path.dirname(require.resolve('@vuco/kit/package.json'))`. NativeWind's Babel setup
  (`jsxImportSource: 'nativewind'` and `nativewind/babel`) lives in `babel.config.js`: a project-wide
  config reaches files in `node_modules`, a `.babelrc` does not.
- **Jest** — `@vuco/kit` joins the `transformIgnorePatterns` allow-list, so Jest transforms the
  kit's TypeScript. Kit source reads two native modules, so the app's Jest setup file mocks them, as
  the kit's own `jest.setup.js` does: `expo-localization` (`getLocales`, returning at least one locale
  with `languageCode` and `languageTag`) and `react-native-safe-area-context` (`useSafeAreaInsets`,
  and `SafeAreaProvider` rendering its children).
- **i18n** — `createI18n({ resources: { en, de }, fallbackLng: 'en' })` runs once at start; the app
  exports the instance it returns. The app's strings are the default `translation` namespace, the
  kit's are `kit`. Document text uses `getFixedT(documentLanguage)` on the same instance.
- **Configs** — `eslint.config.js` is
  `defineConfig([require('@vuco/kit/config/eslint.base.js'), /* app rules */])`, and
  `tsconfig.json` has `"extends": "@vuco/kit/config/tsconfig.base.json"` plus the app's own `paths`
  and `include`.
- **Conventions** — the app's `CLAUDE.md` imports `@node_modules/@vuco/kit/AGENTS.md` below its own
  `@AGENTS.md`.

The React Compiler does not compile kit components: `babel-preset-expo` skips files under
`node_modules`, so they run as written, without automatic memoisation, even in an app that turns the
compiler on. Nothing in the kit relies on it (accepted in vuco's Story 15.2).

## Primitive contracts

Every primitive follows the rules in [AGENTS.md](AGENTS.md#ui-primitives): token classes only,
minimum heights that grow with the font scale, touch targets of at least 48 dp, and an accessibility
role and state on every control.

- `ButtonPrimary` — the full-width pill, one per screen. While pending it shows progress text, never
  a spinner alone; disabled is `ink-disabled` on `surface-sunken`.
- `ButtonSecondary` — the medium-emphasis tonal pill (`primary-tonal` fill, `on-primary-tonal` label):
  the supporting action beside the one loud primary button. `variant="danger"` is the destructive
  version: a red label on a red-ringed transparent ground.
- `Input` — a small uppercase label above a `surface-raised` field with a 1.5 dp boundary. Focus
  changes only the ring (`focus-ring`), never the fill. An optional trailing slot takes an affordance;
  an inline error turns the border `status-overdue` and shows text, never colour alone.
- `Sheet` — the bottom sheet on `surface-raised` with top radius xl. Light mode floats on a soft
  shadow; dark mode has no shadow and a `border-hairline-dark` top edge instead. It keeps clear of the
  bottom safe area and the keyboard. `SHEET_SCRIM_CLASSES` and `SHEET_PANEL_CLASSES` carry the same
  chrome for route-based sheets.
- `OptionRow` — the selection row of a picker: selected means a primary tint, a `link` label and a
  check mark (never colour alone), with radio semantics for screen readers. `grouped` rows sit flat in
  one card, with `divider` on every row but the first.
- `ActionRow` — a tappable row: icon tile, title, one-line subtitle, and a trailing slot that shows
  its own state (a call-to-action lozenge, a done check, or a lock). Done and disabled rows are not
  pressable.
- `ActionChip` — an outline pill that navigates or acts, with optional leading and trailing icons; a
  40 dp lozenge with a hit slop that reaches the 48 dp floor.
- `ChoiceChip` — one option of a pick-one group: selected is filled, unselected sits on
  `surface-sunken`; a 32 dp lozenge with a hit slop that reaches the 48 dp floor.
- `Banner` — the single amber caution surface: icon, one line, optional action. `assertive` takes
  accessibility focus on mount and announces as an alert; the screen still disables its own primary
  button.
- `ScreenHeader` — the one back or close control of a full screen: icon-only (the word lives in the
  accessibility label), pops a pushed screen and dismisses a modal, and falls back to
  `router.replace(fallback)` when there is nothing to go back to.
- `ScreenFooter` — the bottom navigation: an edge-to-edge bar whose `items` share the width, with the
  active one highlighted by shape as well as colour, labels always shown, and a floating
  `primaryAction` button guarded against double taps. It overlays the screen and publishes its
  measured height.
- `bottomBarSpace` — `BottomBarSpaceProvider` and two hooks that share the bar's measured height
  (`useReportBottomBarHeight`, `useBottomBarClearance`), so tab screens pad their last control clear
  of it.
- `SegmentedTabs` — an in-screen tab bar: the selected tab has an underline, never colour alone, and
  each tab can show a count badge.
- `ExplainerCard` — content for an explainer: header icon, title, benefit rows, a primary button,
  and an optional secondary link and disclosure. The consumer supplies the container, such as a
  `Sheet`.
- `icons` — the single icon family (`IconName`). Icons take token classes, so no colour value is
  copied out of the theme.

## Family contracts

Contracts every vuco-family app shares, so the apps build packs, hand-over files and version numbers
the same way. Each app keeps its own data: pack schema and pack contents, strings, version numbers.

### Pack tooling (`src/packs/`)

A pack lives at `<packs>/<id>/pack.json`, where `<id>` has two lowercase letters. It has `packId`
equal to `<id>`, plus `version`, `schemaVersion` and `languages[]`. A translated string is any object
whose keys are all two-letter language codes and whose values are strings. Everything else in a pack,
and its schema, belongs to the app.

- **Validator.** `runPackValidation({ packsDir, schemaFile, ajv: { Ajv2020, addFormats }, checks })`
  compiles the app's JSON Schema (2020-12, strict, all errors, formats), validates every pack, checks
  that `packId` matches its folder and that every translated string covers every language in
  `languages[]`, runs the app's own `checks`, prints one line per pack, and returns 0, 1, or 2 for an
  unreadable schema or folder. The app passes in ajv 8 and ajv-formats 3, which it already installs;
  the kit declares neither.

  ```js
  import Ajv2020 from 'ajv/dist/2020.js';
  import addFormats from 'ajv-formats';
  import { runPackValidation } from '@vuco/kit/src/packs/validatePacks.mjs';

  process.exitCode = await runPackValidation({ packsDir, schemaFile, ajv: { Ajv2020, addFormats }, checks: [appCheck] });
  ```

- **Country-literal lint.** `node node_modules/@vuco/kit/src/packs/countryLiteralLint.mjs --root <dir> --ext .cs
  [--allowlist <file.json>] [--repo-root <dir>] [--packs <dir>] [--tokens <module>]` reports quoted ISO
  3166-1 codes, quoted pack ids, locale literals, "ISO 3166" mentions and the app's pack tokens as
  `[class] path:line token="…"`. It exits 0 when clean, 1 on findings or when it scanned no file, and 2
  on bad arguments or a malformed allowlist. The `--tokens` module's default export returns
  `[{ token, spellings }]`. An app wraps it with its defaults by importing `main(argv)`. The header of
  the file documents every flag and the allowlist format.
- **Copy drift.** A test for each checked-in copy of pack data calls
  `assertPackCopy(pack, copy, { '<copy path>': '<pack path>' })` from `@vuco/kit/src/packs/packCopy`.
  Paths are dot-separated keys; `name[field=value]` selects the one array element whose `field` is
  `value`. A differing value, a path that does not resolve, or a selector that matches no element or
  several fails the test. The message lists every mismatch with both paths and, for a differing
  value, the first place inside it where copy and pack disagree (`at steps[0].label.de: …`).

### App versions (`src/versioning/`)

The version name is `MAJOR.EPIC.STORY.BUILD`; EPIC counts finished epics, not an epic's number in the
plan. `bumpAppVersion(current, 'fix' | 'story' | 'epic')` returns the next name and throws on anything
else; MAJOR moves only by hand. Rules, EAS build numbers and the iOS limit:
[src/versioning/README.md](src/versioning/README.md).

### The `.vuco` hand-over bundle (`src/vuco-file/`)

A ZIP file with `manifest.json` at the root and the photos under `photos/`, so one app can hand a
piece of work to another. `validateVucoBundle(manifest, entries)` checks a parsed manifest against the
archive entries the app read. The kit never opens, writes, hashes or sends a file. Layout, fields and
versioning: [src/vuco-file/README.md](src/vuco-file/README.md).

## Develop

Node 22 or later.

```bash
npm ci
npm run typecheck && npm run lint && npm test
node tokens/generate-tokens.mjs --check --brand vuco
node tokens/check-tnum.mjs
node tokens/check-dark-pairing.mjs --src src --allowlist dark-pairing-allowlist.json
```

`npm test` runs the node:test suites (token tooling, pack validator and lint, version helper) and the
Jest suites (primitives, i18n factory, copy-drift helper, `.vuco` validator), on the stack vuco's app
tests use.

To try a change in an app before its tag exists, run `npm pack` here and
`npm install --no-save <path-to-tgz>` in the app, then restart Metro with `-c`. Never `npm link` the
kit or install it from a folder path: both symlink it, Metro and Jest then resolve the kit's own
`node_modules`, and the app runs a second React and a second i18next whose strings render as raw keys.

Releasing: [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

All rights reserved — see [LICENSE](LICENSE). A public repository is not an open licence. The
fonts in `tokens/fonts/` are the exception: SIL Open Font License 1.1.
