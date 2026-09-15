# design/tokens — single-source design tokens (AR-20 / UX-DR1)

The ONE source of visual truth is the frontmatter of
`_bmad-output/planning-artifacts/ux-designs/ux-vuco-2026-07-15/DESIGN.md`
(colors light+dark, typography roles, radii, spacing, component tokens).
Everything a renderer styles with is GENERATED from it — hand-copied token
values are a review-rejectable offense.

## Pipeline

```
DESIGN.md frontmatter ──┐
font-verdict.json ──────┴─> generate-tokens.mjs ──> 3 outputs (committed)
```

| Output | Consumer |
| --- | --- |
| `out/nativewind-theme.cjs` | `apps/mobile/tailwind.config.js` (`theme.extend`) + `vuco` component tokens |
| `server/src/Vuco.Api/wwwroot/css/tokens.css` | Hosted Page (Epic 6): CSS custom properties + self-hosted `@font-face` (AD-14) |
| `out/VucoDesignTokens.g.cs` | QuestPDF document renderer (Story 5.3) — not compiled until then |

Commands (from repo root, after `npm ci` in design/tokens):

- `node design/tokens/generate-tokens.mjs` — regenerate all outputs
- `node design/tokens/generate-tokens.mjs --check` — CI staleness gate (byte compare)
- `node design/tokens/check-tnum.mjs` — verify tabular figures; writes `font-verdict.json`

CI: `.github/workflows/design-tokens.yml` fails on stale outputs, stale verdict, or a
font that loses tnum. Outputs are byte-stable (LF, no timestamps; header carries a
frontmatter content hash).

## Fonts & the money role (AR-24)

**Verdict 2026-07-16: tnum CONFIRMED for Plus Jakarta Sans 2.7.1** (all 5 weights,
digits uniformly 600/1000 upem) — Plus Jakarta Sans is the money role in all three
renderers; the Inter fallback was not needed. See `fonts/README.md` and
`tools/FontProbe/` (QuestPDF embedding proof). The generator maps the money role from
`font-verdict.json` — never edit the mapping by hand.

## Changing tokens

1. Edit DESIGN.md frontmatter (re-verify the contrast table per DESIGN.md rules).
2. `node design/tokens/generate-tokens.mjs`
3. Commit source + outputs together; CI enforces they match.
