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

**Fixel Text** (static TTFs `FixelText-<Weight>.ttf`, weights 400/500/600/700/800) — the text
roles of a Cyrillic App Language (kit 0.9.0, vuco Story 16.1: Ukrainian). Plus Jakarta Sans has no
Cyrillic. Designed by MacPaw with AlfaBravo, Kyiv (authors of record: Kyrylo Tkachov, Marchela
Mozhyna, Serhii Makarenko, Zakhar Kryvoshyia, Mariia Vainshtein). Fetched 2026-10-08 from
`MacPaw/Fixel`, `fonts/ttf/` (tree 514fd02e); the git blob hashes were verified against that tree:

| File | Upstream blob | SHA-256 of the file here |
| --- | --- | --- |
| `FixelText-Regular.ttf` | `e6d0cc95` | `8256a12ce9de317e6a6e4502106d8c4304346f320e52590202ca86713c27b6e5` |
| `FixelText-Medium.ttf` | `d218f726` | `02267d4808ee82e609062c9667bd3abc508c55c61ba7d24db46daec2550cafc9` |
| `FixelText-SemiBold.ttf` | `4201e483` | `714a2d89f968af68765a4955a3ffa7813a3329aceb44e0ee21385da09f4d6f4a` |
| `FixelText-Bold.ttf` | `90af473b` | `d9c4add152714eaaaada5ca333d8407905663f6e9097feb238e08199374cce9e` |
| `FixelText-ExtraBold.ttf` | `95c1b6c3` | `e3c7c0365153c0951be9f3911c1da658b8e7f8b53e0dede6fdbb031cb47f7b97` |

**One edit:** upstream declares `OS/2.usWidthClass = 4` (semi-condensed); these copies say 5
(normal), so a width-aware font matcher picks them as the regular width. Nothing else changed: each
file differs from upstream in three bytes only — the width class itself, the `OS/2` table checksum in
the table directory, and `head.checkSumAdjustment`, which the OpenType format requires to follow the
edited bytes. Family, PostScript and file names are kept: the licence declares no Reserved Font Name.
License: **SIL Open Font License 1.1** — upstream's `OFL.txt`, verbatim, in `FixelText-OFL.txt`
(blob `7c61bd88`).

Fixel Text is **never a money face**: money stays Plus Jakarta Sans in every App Language.
`../check-tnum.mjs` records the Fixel facts in `../font-verdict.json` (`cyrillicTextFaces`) without
gating on them: complete Ukrainian letters (а–я plus і ї є ґ), PostScript name = file name, width
class 5, `tnum` present — and its tabular digits are not uniform (`nine.tf` is 599/1000 in Regular,
Medium and SemiBold; kerning moves `four.tf` before `five.tf`), its tabular zero, one and seven are
slashed, footed and barred with no plain alternate, and it has no U+00A0 glyph.

These files are the canonical copies. Consumers use them straight from the installed kit tag
(for example as `expo-font` config-plugin paths) or keep byte-identical copies refreshed from
it (self-hosted web fonts, fonts embedded in PDFs) — never an edited or re-exported file.

Replacing a weight: replace the file here, re-run `node check-tnum.mjs` and
`node generate-tokens.mjs --brand <brand>`, let kit CI verify, then release.
