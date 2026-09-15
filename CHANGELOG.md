# Changelog

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
