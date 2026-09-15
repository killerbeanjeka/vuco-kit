# Bundled fonts

**Plus Jakarta Sans 2.7.1** (static TTFs, weights 400/500/600/700/800) — fetched
2026-07-16 from the official source `tokotype/PlusJakartaSans` (master @ 18d1cd2,
release 2.7.1). License: **SIL Open Font License 1.1** — free to bundle, self-host,
and embed in documents.

**tnum verdict (Story 1.7, AR-24): CONFIRMED** — every weight carries the `tnum`
OpenType feature and all ten digits share one advance width (600/1000 upem) under it.
Verified mechanically by `../check-tnum.mjs` (machine verdict in `../font-verdict.json`),
in app rendering (emulator screenshot in story 1.7 evidence), and in a QuestPDF-embedded
PDF (`tools/FontProbe`). **Plus Jakarta Sans is the money role — no Inter fallback needed.**

These files are the canonical copies. The same TTFs are duplicated to:
- `apps/mobile/assets/fonts/` — app bundle (runtime `useFonts` today; expo-font config
  plugin embeds them natively on the next EAS build)
- `server/src/Vuco.Api/wwwroot/fonts/` — self-hosted for the Hosted Page (AD-14)

Replacing or adding a weight: update all three copies, re-run `node check-tnum.mjs`
and `node generate-tokens.mjs`, and let the design-tokens CI gate verify.
