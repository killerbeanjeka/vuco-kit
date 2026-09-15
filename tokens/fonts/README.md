# Bundled fonts

**Plus Jakarta Sans 2.7.1** (static TTFs, weights 400/500/600/700/800) — fetched
2026-07-16 from the official source `tokotype/PlusJakartaSans` (master @ 18d1cd2,
release 2.7.1, `fonts/ttf/`; git blob hashes re-checked against that commit 2026-09-15).
License: **SIL Open Font License 1.1** — full text in `OFL.txt`, taken from the same commit.
Free to bundle, self-host, and embed in documents.

**tnum verdict (Story 1.7, AR-24): CONFIRMED** — every weight carries the `tnum`
OpenType feature and all ten digits share one advance width (600/1000 upem) under it.
Verified mechanically by `../check-tnum.mjs` (machine verdict in `../font-verdict.json`),
in app rendering, and in a QuestPDF-embedded PDF. **Plus Jakarta Sans is the money role —
no Inter fallback needed.**

These files are the canonical copies. Consumers use them straight from the installed kit tag
(for example as `expo-font` config-plugin paths) or keep byte-identical copies refreshed from
it (self-hosted web fonts, fonts embedded in PDFs) — never an edited or re-exported file.

Replacing a weight: replace the file here, re-run `node check-tnum.mjs` and
`node generate-tokens.mjs --brand <brand>`, let kit CI verify, then release.
