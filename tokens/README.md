# tokens — single-source design tokens (AR-20 / UX-DR1)

The ONE source of visual truth is `base.tokens.yaml` completed by one brand file,
`brands/<brand>.yaml` (colours light + dark, typography roles, radii, spacing, component
tokens). Everything a renderer styles with is GENERATED from them — hand-copied token values
are a review-rejectable offense.

## Base and brands

`base.tokens.yaml` holds every token, in output order. A `null` value is a brand-owned slot —
today the action colour family (`primary`, `on-primary`, `primary-tonal`, `on-primary-tonal`,
`link`, `focus-ring`) and the accent pair (`accent`, `on-accent`), each with its `-dark` twin.
A brand file fills every slot and sets nothing else; otherwise the generator exits 2 naming
the key and writes nothing. The merge (`mergeBrand`, exported by the generator) walks the base
order, so a brand never reorders the outputs.

## Pipeline

```
base.tokens.yaml ──────┐
brands/<brand>.yaml ───┼─> generate-tokens.mjs --brand <brand> ──> out/<brand>/ (committed)
font-verdict.json ─────┘
```

| Output (`out/<brand>/`) | Consumer |
| --- | --- |
| `nativewind-theme.cjs` | the app's `tailwind.config.js` (`theme.extend`) + component tokens |
| `tokens.css` | Hosted Page: CSS custom properties + self-hosted `@font-face` (AD-14) |
| `VucoDesignTokens.g.cs` | QuestPDF document renderer |

Commands (from the repository root, after `npm ci`):

- `node tokens/generate-tokens.mjs --brand vuco` — regenerate `out/vuco/`
- `node tokens/generate-tokens.mjs --check --brand vuco` — CI staleness gate (byte compare)
- `node tokens/check-tnum.mjs` — verify tabular figures; writes `font-verdict.json`
- `node tokens/check-dark-pairing.mjs --src <dir> --allowlist <file.json> [--theme <file>]` —
  run by a consuming app over its own source: every dual-mode colour token is paired with its
  `-dark` variant; files that are single-mode on purpose are listed in the app's allowlist
  with the reason

CI (`.github/workflows/kit-ci.yml`) fails on stale outputs, a stale verdict, or a font that
loses tnum. Outputs are byte-stable (LF, no timestamps); header line 1 names both sources and
carries a content hash of them.

Consumers never regenerate: they read `out/<brand>/` and `fonts/` from the installed kit tag,
or keep byte copies refreshed from it.

## Fonts & the money role (AR-24)

**Verdict 2026-07-16: tnum CONFIRMED for Plus Jakarta Sans 2.7.1** (all 5 weights,
digits uniformly 600/1000 upem) — Plus Jakarta Sans is the money role in all three
renderers; the Inter fallback was not needed. See `fonts/README.md`. The generator maps the
money role from `font-verdict.json` — never edit the mapping by hand.

## Changing tokens

1. Edit `base.tokens.yaml` or `brands/<brand>.yaml`, and re-verify the contrast table in the
   consuming app's design spec.
2. `node tokens/generate-tokens.mjs --brand <brand>`
3. Commit sources and outputs together — CI enforces that they match — then release
   (`CONTRIBUTING.md`).
