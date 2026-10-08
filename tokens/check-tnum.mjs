#!/usr/bin/env node
// tnum verification (Story 1.7, AC 2 — AR-24): the money role needs tabular figures.
// For every money face, assert (a) the 'tnum' OpenType feature exists and
// (b) digits 0-9 all share ONE advance width when laid out with tnum applied.
// Writes the machine-readable verdict to font-verdict.json (generator input).
//
// Kit 0.9.0 adds the Cyrillic text faces (Fixel Text, the text roles of a Cyrillic App Language).
// They are RECORDED in the verdict's `cyrillicTextFaces` block and never gate the money verdict:
// money stays Plus Jakarta Sans in every language, so vuco never renders Fixel's tabular digits.
// CI's clean-tree gate still catches any change to what is recorded about them.
//
// Exit codes: 0 = confirmed for all money faces; 1 = NOT confirmed (money role -> fallback);
//             2 = tooling/input error (missing fonts dir, missing or unexpected face, unreadable
//             file, bad args) — never confuse an error with a verdict.
//
// Usage: node check-tnum.mjs [--font <path.ttf>]   (--font: check one file, no verdict write)
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";

const tokensDir = dirname(fileURLToPath(import.meta.url));
/** @param {unknown} err */
const reason = (err) => (err instanceof Error ? err.message : String(err));
const argFont = process.argv.indexOf("--font");
const singleFont = argFont > -1 ? process.argv[argFont + 1] : null;
if (argFont > -1 && !singleFont) {
  console.error("check-tnum: --font requires a path");
  process.exit(2);
}

const DIGITS = "0123456789";
// The five faces the typography roles map to — a missing one must fail the gate,
// or outputs would reference a face with no font file behind it. These are also the money faces.
const REQUIRED = [
  "PlusJakartaSans-Regular.ttf",
  "PlusJakartaSans-Medium.ttf",
  "PlusJakartaSans-SemiBold.ttf",
  "PlusJakartaSans-Bold.ttf",
  "PlusJakartaSans-ExtraBold.ttf",
];
// The text roles' faces for a Cyrillic App Language (src/fonts/fontRoleVars.ts FONT_ROLE_VARS.cyrillic).
// Required too: a missing one would leave a variable naming a face with no file behind it.
const CYRILLIC_TEXT = [
  "FixelText-Regular.ttf",
  "FixelText-Medium.ttf",
  "FixelText-SemiBold.ttf",
  "FixelText-Bold.ttf",
  "FixelText-ExtraBold.ttf",
];
// Ukrainian needs а–я (U+0430–U+044F) plus і ї є ґ.
const UKRAINIAN_LETTERS = [
  ...Array.from({ length: 0x44f - 0x430 + 1 }, (_, i) => String.fromCodePoint(0x430 + i)),
  "і",
  "ї",
  "є",
  "ґ",
];

/** @param {string} path */
function checkFont(path) {
  const font = fontkit.openSync(path);
  const hasTnum = font.availableFeatures.includes("tnum");
  const run = font.layout(DIGITS, ["tnum"]);
  const widths = run.positions.map((p) => p.xAdvance);
  const allEqual = widths.every((w) => w === widths[0]);
  return {
    family: font.familyName,
    postscriptName: font.postscriptName,
    hasTnum,
    tabularWidth: allEqual ? widths[0] : null,
    unitsPerEm: font.unitsPerEm,
    digitWidths: widths,
    pass: hasTnum && allEqual,
  };
}

/**
 * What the verdict records about a Cyrillic text face. Nothing here gates; the notes say, in words,
 * where the face departs from what a money face would need.
 * @param {string} path
 * @param {string} file
 */
function describeTextFace(path, file) {
  const font = fontkit.openSync(path);
  const run = font.layout(DIGITS, ["tnum"]);
  const advances = run.glyphs.map((glyph) => glyph.advanceWidth);
  const laidOut = run.positions.map((p) => p.xAdvance);
  const missingLetters = UKRAINIAN_LETTERS.filter((letter) => !font.hasGlyphForCodePoint(/** @type {number} */ (letter.codePointAt(0))));
  const hasNoBreakSpace = font.hasGlyphForCodePoint(0xa0);
  const usual = mostCommon(advances);
  /** @type {string[]} */
  const notes = [];
  const odd = run.glyphs.flatMap((glyph, i) => (advances[i] === usual ? [] : [`${glyph.name} is ${advances[i]}`]));
  if (odd.length) notes.push(`tabular digits are ${usual}/${font.unitsPerEm} except ${odd.join(", ")}`);
  const kerned = run.glyphs.flatMap((glyph, i) =>
    laidOut[i] === advances[i] ? [] : [`${glyph.name} before ${run.glyphs[i + 1]?.name ?? "the end"} by ${laidOut[i] - advances[i]}`],
  );
  if (kerned.length) notes.push(`kerning moves tabular digits when laid out: ${kerned.join(", ")}`);
  if (!hasNoBreakSpace) notes.push("no U+00A0 (no-break space) glyph");
  return {
    file,
    family: font.familyName,
    postscriptName: font.postscriptName,
    postscriptMatchesFile: font.postscriptName === file.replace(/\.ttf$/, ""),
    usWidthClass: font["OS/2"].usWidthClass,
    usWeightClass: font["OS/2"].usWeightClass,
    ukrainianLettersMissing: missingLetters.join(""),
    hasTnum: font.availableFeatures.includes("tnum"),
    tabularDigitAdvances: advances,
    hasNoBreakSpace,
    notes,
  };
}

/** @param {number[]} values */
function mostCommon(values) {
  /** @type {Map<number, number>} */
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

if (singleFont) {
  let r;
  try {
    r = checkFont(singleFont);
  } catch (err) {
    console.error(`check-tnum: cannot read '${singleFont}' as a font — ${reason(err)}`);
    process.exit(2);
  }
  console.log(`${r.postscriptName}: tnum=${r.hasTnum} equal-advances=${r.tabularWidth !== null} -> ${r.pass ? "PASS" : "FAIL"}`);
  if (!r.pass) console.log(`  digit widths: ${r.digitWidths.join(" ")}`);
  process.exit(r.pass ? 0 : 1);
}

const fontsDir = join(tokensDir, "fonts");
let files;
try {
  files = (await readdir(fontsDir)).filter((f) => f.endsWith(".ttf")).sort();
} catch {
  console.error(`check-tnum: fonts directory missing (${fontsDir})`);
  process.exit(2);
}
const missing = [...REQUIRED, ...CYRILLIC_TEXT].filter((f) => !files.includes(f));
if (missing.length) {
  console.error(`check-tnum: required weight file(s) missing: ${missing.join(", ")}`);
  process.exit(2);
}
// A face no role maps to would ship in every app unchecked.
const unexpected = files.filter((f) => !REQUIRED.includes(f) && !CYRILLIC_TEXT.includes(f));
if (unexpected.length) {
  console.error(`check-tnum: font file(s) no role maps to: ${unexpected.join(", ")} — add them to REQUIRED or CYRILLIC_TEXT, or remove them`);
  process.exit(2);
}

const results = [];
const textFaces = [];
for (const f of files) {
  try {
    if (REQUIRED.includes(f)) results.push(checkFont(join(fontsDir, f)));
    else textFaces.push(describeTextFace(join(fontsDir, f), f));
  } catch (err) {
    console.error(`check-tnum: cannot read '${f}' as a font — ${reason(err)}`);
    process.exit(2);
  }
}
let allPass = true;
for (const r of results) {
  const status = r.pass ? "PASS" : "FAIL";
  console.log(`${status}  ${r.postscriptName}  tnum=${r.hasTnum}  tabular-advance=${r.tabularWidth ?? "UNEQUAL"}/${r.unitsPerEm}upem`);
  if (!r.pass) {
    allPass = false;
    console.log(`      digit widths under tnum: ${r.digitWidths.join(" ")}`);
  }
}
for (const face of textFaces) {
  console.log(
    `TEXT  ${face.postscriptName}  ukrainian=${face.ukrainianLettersMissing === "" ? "complete" : `missing ${face.ukrainianLettersMissing}`}` +
      `  ps=file:${face.postscriptMatchesFile}  width-class=${face.usWidthClass}  tnum=${face.hasTnum}` +
      (face.notes.length ? `\n      (recorded, not gated) ${face.notes.join("; ")}` : ""),
  );
}

// verifiedOn: keep the previous date while results are unchanged (byte-stable verdict
// for the CI gate); stamp today only when the verification RESULTS actually change.
// The money date follows the money faces alone, so recording a text face never moves it
// (the generated outputs carry it).
const verdictPath = join(tokensDir, "font-verdict.json");
let previous = null;
try {
  previous = JSON.parse((await readFile(verdictPath, "utf8")).replace(/\r\n/g, "\n"));
} catch {
  // no previous verdict — first run
}
const today = new Date().toISOString().slice(0, 10);
const resultsUnchanged =
  previous && JSON.stringify(previous.fonts) === JSON.stringify(results) && previous.tnumConfirmed === allPass;
const verifiedOn = resultsUnchanged ? previous.verifiedOn : today;
const textUnchanged = previous?.cyrillicTextFaces && JSON.stringify(previous.cyrillicTextFaces.fonts) === JSON.stringify(textFaces);
const textVerifiedOn = textUnchanged ? previous.cyrillicTextFaces.verifiedOn : today;

const verdict = {
  verifiedOn,
  method: "fontkit 2.0.4: GSUB feature presence + digit advance-width equality under tnum",
  fonts: results,
  tnumConfirmed: allPass,
  moneyFontFamily: allPass ? "Plus Jakarta Sans" : "Inter",
  moneyFontPostscript: allPass ? "PlusJakartaSans-Bold" : "Inter-Bold",
  cyrillicTextFaces: {
    verifiedOn: textVerifiedOn,
    use: "the text roles (display, title, heading, body, field, meta) of a Cyrillic App Language; money stays Plus Jakarta Sans",
    gated: false,
    method: "fontkit 2.0.4: cmap coverage of а–я plus і ї є ґ, name and OS/2 tables, GSUB tnum presence, tabular digit advances",
    fonts: textFaces,
  },
};
await writeFile(verdictPath, JSON.stringify(verdict, null, 2) + "\n", "utf8");
console.log(`\nverdict: tnum ${allPass ? "CONFIRMED — Plus Jakarta Sans is the money role" : "NOT confirmed — money role falls back to Inter"} (font-verdict.json written, verifiedOn ${verifiedOn})`);
process.exit(allPass ? 0 : 1);
