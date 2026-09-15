#!/usr/bin/env node
// tnum verification (Story 1.7, AC 2 — AR-24): the money role needs tabular figures.
// For every bundled weight, assert (a) the 'tnum' OpenType feature exists and
// (b) digits 0-9 all share ONE advance width when laid out with tnum applied.
// Writes the machine-readable verdict to font-verdict.json (generator input).
//
// Exit codes: 0 = confirmed for all weights; 1 = NOT confirmed (money role -> fallback);
//             2 = tooling/input error (missing fonts dir, unreadable file, bad args) —
//             never confuse an error with a verdict.
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
// or outputs would reference a face with no font file behind it.
const REQUIRED = [
  "PlusJakartaSans-Regular.ttf",
  "PlusJakartaSans-Medium.ttf",
  "PlusJakartaSans-SemiBold.ttf",
  "PlusJakartaSans-Bold.ttf",
  "PlusJakartaSans-ExtraBold.ttf",
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
const missing = REQUIRED.filter((f) => !files.includes(f));
if (missing.length) {
  console.error(`check-tnum: required weight file(s) missing: ${missing.join(", ")}`);
  process.exit(2);
}

const results = [];
for (const f of files) {
  try {
    results.push(checkFont(join(fontsDir, f)));
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

// verifiedOn: keep the previous date while results are unchanged (byte-stable verdict
// for the CI gate); stamp today only when the verification RESULTS actually change.
const verdictPath = join(tokensDir, "font-verdict.json");
let previous = null;
try {
  previous = JSON.parse((await readFile(verdictPath, "utf8")).replace(/\r\n/g, "\n"));
} catch {
  // no previous verdict — first run
}
const resultsUnchanged =
  previous && JSON.stringify(previous.fonts) === JSON.stringify(results) && previous.tnumConfirmed === allPass;
const verifiedOn = resultsUnchanged ? previous.verifiedOn : new Date().toISOString().slice(0, 10);

const verdict = {
  verifiedOn,
  method: "fontkit 2.0.4: GSUB feature presence + digit advance-width equality under tnum",
  fonts: results,
  tnumConfirmed: allPass,
  moneyFontFamily: allPass ? "Plus Jakarta Sans" : "Inter",
  moneyFontPostscript: allPass ? "PlusJakartaSans-Bold" : "Inter-Bold",
};
await writeFile(verdictPath, JSON.stringify(verdict, null, 2) + "\n", "utf8");
console.log(`\nverdict: tnum ${allPass ? "CONFIRMED — Plus Jakarta Sans is the money role" : "NOT confirmed — money role falls back to Inter"} (font-verdict.json written, verifiedOn ${verifiedOn})`);
process.exit(allPass ? 0 : 1);
