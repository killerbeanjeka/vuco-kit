# Changelog

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
