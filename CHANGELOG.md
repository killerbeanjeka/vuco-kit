# Changelog

## Unreleased

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
