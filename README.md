# @vuco/kit

The shared layer of the vuco app family: the design tokens, their generator and checks, the fonts,
the UI primitives, the i18n setup, and the base lint and TypeScript configs.

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
| `src/ui/<Name>.tsx` | The cross-app UI primitives — `ButtonPrimary`, `ButtonSecondary`, `Input`, `Sheet`, `OptionRow`, `ActionRow`, `ActionChip`, `ChoiceChip`, `Banner`, `ScreenHeader`, `ScreenFooter`, `SegmentedTabs`, `ExplainerCard`, `icons`, `bottomBarSpace` — as TypeScript source styled with the token classes. |
| `src/i18n/` | `createI18n({ resources, fallbackLng })` and `deviceBestMatchLanguage()`; `en.json` and `de.json` hold the words the primitives render (the `kit` namespace). |
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

- **NativeWind** — `tailwind.config.js` scans the kit as well, or every class that only kit source
  uses renders unstyled, with no error:
  `content: ['./src/**/*.{ts,tsx}', './node_modules/@vuco/kit/src/**/*.{ts,tsx}']`.
  The glob assumes the kit at `./node_modules/@vuco/kit`, npm's layout for an app with its own
  `node_modules`; where a workspace hoists the kit, build the glob from
  `path.dirname(require.resolve('@vuco/kit/package.json'))`. NativeWind's Babel setup
  (`jsxImportSource: 'nativewind'` and `nativewind/babel`) lives in `babel.config.js`: a project-wide
  config reaches files in `node_modules`, a `.babelrc` does not.
- **Jest** — `@vuco/kit` joins the `transformIgnorePatterns` allow-list, so Jest transforms the
  kit's TypeScript.
- **i18n** — `createI18n({ resources: { en, de }, fallbackLng: 'en' })` runs once at start; the app
  exports the instance it returns. The app's strings are the default `translation` namespace, the
  kit's are `kit`. Document text uses `getFixedT(documentLanguage)` on the same instance.
- **Configs** — `eslint.config.js` is
  `defineConfig([require('@vuco/kit/config/eslint.base.js'), /* app rules */])`, and
  `tsconfig.json` has `"extends": "@vuco/kit/config/tsconfig.base.json"` plus the app's own `paths`
  and `include`.
- **Conventions** — the app's `CLAUDE.md` imports `@node_modules/@vuco/kit/AGENTS.md` below its own
  `@AGENTS.md`.

## Develop

Node 22 or later.

```bash
npm ci
npm run typecheck && npm run lint && npm test
node tokens/generate-tokens.mjs --check --brand vuco
node tokens/check-tnum.mjs
node tokens/check-dark-pairing.mjs --src src --allowlist dark-pairing-allowlist.json
```

`npm test` runs the node:test suites of the token tooling and the Jest suites of the primitives and
the i18n factory, on the stack vuco's app tests use.

To try a change in an app before its tag exists, run `npm pack` here and
`npm install --no-save <path-to-tgz>` in the app, then restart Metro with `-c`. Never `npm link` the
kit or install it from a folder path: both symlink it, Metro and Jest then resolve the kit's own
`node_modules`, and the app runs a second React and a second i18next whose strings render as raw keys.

Releasing: [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

All rights reserved — see [LICENSE](LICENSE). A public repository is not an open licence. The
fonts in `tokens/fonts/` are the exception: SIL Open Font License 1.1.
