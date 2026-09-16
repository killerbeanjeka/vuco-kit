#!/usr/bin/env node
// The country-literal lint of a vuco-family app (Story 15.3; the engine of vuco's Story 1.6 pack lint,
// AD-1/AR-4). Core code must contain no country literals: country-variable behaviour belongs in the
// packs. The lint scans the files under --root for three mechanical classes:
//   country-code : quoted ISO 3166-1 alpha-2 and alpha-3 codes ("DE", "DEU", …; the full sets), and
//                  quoted lowercase pack ids ("de": country dispatch in core)
//   iso-marker   : quoted locale literals ("de-DE", "de_DE") and "ISO 3166" mentions
//   pack-field   : the app's distinctive pack tokens (--tokens), in every spelling the app lists
// Wordings and statute references are enforced in review, not by this lint.
//
//   node countryLiteralLint.mjs --root <dir> --ext <list> [--allowlist <file.json>]
//                              [--repo-root <dir>] [--packs <dir>] [--tokens <module>]
//
//   --root       the tree to scan; folders named bin, obj and node_modules are skipped
//   --ext        comma-separated file extensions to scan, e.g. .cs or .cs,.ts
//   --allowlist  {"entries": [{"path": "<glob>", "class": "<class>", "token": "<optional>", "reason": "<why>"}]}.
//                `**/` matches whole path segments, `*` and `?` stay inside one. A missing file means no
//                exemptions; a malformed one is an error.
//   --repo-root  the base of the allowlist globs and of the report paths (default: the working directory)
//   --packs      the packs folder: its two-letter directory names are the pack ids
//   --tokens     an ES module whose default export returns, or resolves to, [{ token, spellings }]
//
// Report lines: `[class] path:line token="…" — why`, then the trimmed source line.
// Exit codes: 0 = clean; 1 = findings, or 0 files scanned; 2 = bad arguments, an unreadable --root,
// --packs or --tokens, or a malformed allowlist — never confuse an error with a verdict.
//
// An app wraps this with its own defaults (vuco: packs/lint/pack-lint.mjs) and calls main(argv).

import { readdirSync, realpathSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const USAGE =
  "usage: node countryLiteralLint.mjs --root <dir> --ext <list> [--allowlist <file.json>] " +
  "[--repo-root <dir>] [--packs <dir>] [--tokens <module>]";
const FLAGS = ["--root", "--ext", "--allowlist", "--repo-root", "--packs", "--tokens"];
const CLASSES = ["country-code", "iso-marker", "pack-field"];
const SKIPPED_DIRS = new Set(["bin", "obj", "node_modules"]);

// ISO 3166-1 alpha-2 and alpha-3, both full 249-code sets; flagged only as EXACT quoted string literals.
const ALPHA2 = new Set(("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" "));
const ALPHA3 = new Set(("ABW AFG AGO AIA ALA ALB AND ARE ARG ARM ASM ATA ATF ATG AUS AUT AZE BDI BEL BEN BES BFA BGD BGR BHR BHS BIH BLM BLR BLZ BMU BOL BRA BRB BRN BTN BVT BWA CAF CAN CCK CHE CHL CHN CIV CMR COD COG COK COL COM CPV CRI CUB CUW CXR CYM CYP CZE DEU DJI DMA DNK DOM DZA ECU EGY ERI ESH ESP EST ETH FIN FJI FLK FRA FRO FSM GAB GBR GEO GGY GHA GIB GIN GLP GMB GNB GNQ GRC GRD GRL GTM GUF GUM GUY HKG HMD HND HRV HTI HUN IDN IMN IND IOT IRL IRN IRQ ISL ISR ITA JAM JEY JOR JPN KAZ KEN KGZ KHM KIR KNA KOR KWT LAO LBN LBR LBY LCA LIE LKA LSO LTU LUX LVA MAC MAF MAR MCO MDA MDG MDV MEX MHL MKD MLI MLT MMR MNE MNG MNP MOZ MRT MSR MTQ MUS MWI MYS MYT NAM NCL NER NFK NGA NIC NIU NLD NOR NPL NRU NZL OMN PAK PAN PCN PER PHL PLW PNG POL PRI PRK PRT PRY PSE PYF QAT REU ROU RUS RWA SAU SDN SEN SGP SGS SHN SJM SLB SLE SLV SMR SOM SPM SRB SSD STP SUR SVK SVN SWE SWZ SXM SYC SYR TCA TCD TGO THA TJK TKL TKM TLS TON TTO TUN TUR TUV TWN TZA UGA UKR UMI URY USA UZB VAT VCT VEN VGB VIR VNM VUT WLF WSM YEM ZAF ZMB ZWE").split(" "));

/**
 * @typedef {object} PackToken
 * @property {string} token  the name reported
 * @property {string[]} spellings  every spelling that counts as a use of it
 *
 * @typedef {object} AllowlistEntry
 * @property {string} path
 * @property {string} class
 * @property {string} [token]
 * @property {string} reason
 */

/** Thrown for unusable input (packs, tokens, allowlist); main() prints it and returns 2. */
class LintError extends Error {}

/** Thrown for a bad command line; main() also prints the usage line. */
class UsageError extends LintError {}

/** @param {unknown} err */
const reason = (err) => (err instanceof Error ? err.message : String(err));

/**
 * A path as the report shows it: relative to the working directory when it lies below it.
 * @param {string} path
 */
function display(path) {
  const rel = relative(process.cwd(), path);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel.split(sep).join("/") : path;
}

/** @param {string} path */
function isDirectory(path) {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
}

/**
 * @param {string[]} argv
 * @returns {Map<string, string>}
 */
function parseArgs(argv) {
  /** @type {Map<string, string>} */
  const values = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    if (!FLAGS.includes(name)) throw new UsageError(`unknown argument ${name}`);
    if (values.has(name)) throw new UsageError(`${name} is given twice`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) throw new UsageError(`${name} needs a value`);
    values.set(name, value);
  }
  return values;
}

/**
 * @param {string} list
 * @returns {string[]}
 */
function parseExtensions(list) {
  const extensions = list.split(",").map((ext) => ext.trim());
  if (!extensions.every((ext) => /^\.?[A-Za-z0-9]+$/.test(ext))) {
    throw new UsageError(`--ext ${list} must list extensions such as .cs or .cs,.ts`);
  }
  return extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
}

/**
 * @param {string} dir
 * @returns {Set<string>}
 */
function readPackIds(dir) {
  try {
    return new Set(
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^[a-z]{2}$/.test(entry.name))
        .map((entry) => entry.name),
    );
  } catch (err) {
    throw new LintError(`cannot read --packs ${display(dir)} — ${reason(err)}`);
  }
}

/**
 * @param {string} file
 * @returns {Promise<PackToken[]>}
 */
async function loadTokens(file) {
  /** @type {unknown} */
  let tokens;
  try {
    const loaded = await import(pathToFileURL(file).href);
    if (typeof loaded.default !== "function") throw new Error("its default export is not a function");
    tokens = await loaded.default();
  } catch (err) {
    throw new LintError(`cannot use --tokens ${display(file)} — ${reason(err)}`);
  }
  const valid =
    Array.isArray(tokens) &&
    tokens.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.token === "string" &&
        item.token.length > 0 &&
        Array.isArray(item.spellings) &&
        item.spellings.length > 0 &&
        item.spellings.every((/** @type {unknown} */ spelling) => typeof spelling === "string" && spelling.length > 0),
    );
  if (!valid) {
    throw new LintError(`--tokens ${display(file)} must return [{ token, spellings }] with non-empty strings`);
  }
  return /** @type {PackToken[]} */ (tokens);
}

/**
 * A missing allowlist means no exemptions; a malformed one fails loud, because a swallowed parse error
 * would silently strip every sanctioned exemption and a silently accepted bad entry would exempt too much.
 * @param {string} file
 * @returns {Promise<AllowlistEntry[]>}
 */
async function loadAllowlist(file) {
  const name = display(file);
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return [];
    throw new LintError(`cannot read ${name} — ${reason(err)}`);
  }
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LintError(`${name} is not valid JSON — ${reason(err)}`);
  }
  const entries = parsed !== null && typeof parsed === "object" ? /** @type {{ entries?: unknown }} */ (parsed).entries : undefined;
  if (!Array.isArray(entries)) throw new LintError(`${name} must have an "entries" array`);
  entries.forEach((entry, i) => {
    const bad =
      entry === null || typeof entry !== "object" ? "must be an object"
      : typeof entry.path !== "string" || entry.path.length === 0 ? "path must be a non-empty string"
      : !CLASSES.includes(entry.class) ? `class must be one of ${CLASSES.join(" | ")}`
      : typeof entry.reason !== "string" || entry.reason.length === 0 ? "reason must be a non-empty string"
      : entry.token !== undefined && (typeof entry.token !== "string" || entry.token.length === 0)
        ? "token, when present, must be a non-empty string"
      : null;
    if (bad) throw new LintError(`${name} entries[${i}] invalid — ${bad}`);
  });
  return entries;
}

/**
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?"; // "**/" matches zero or more whole segments
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/, (c) => "\\" + c);
    }
  }
  return new RegExp("^" + re + "$");
}

/**
 * @param {AllowlistEntry[]} allowlist
 * @param {string} relPath
 * @param {string} cls
 * @param {string} token
 */
function isAllowed(allowlist, relPath, cls, token) {
  return allowlist.some(
    (entry) =>
      globToRegExp(entry.path).test(relPath) &&
      entry.class === cls &&
      (!entry.token || entry.token === token) &&
      typeof entry.reason === "string" &&
      entry.reason.length > 0,
  );
}

/**
 * @param {string} dir
 * @param {string[]} extensions
 * @returns {AsyncGenerator<string>}
 */
async function* walk(dir, extensions) {
  const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) yield* walk(path, extensions);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      yield path;
    }
  }
}

/**
 * Runs the lint and prints the report.
 * @param {string[]} argv  the arguments after the script name
 * @returns {Promise<0 | 1 | 2>}
 */
export async function main(argv) {
  /** @type {string} */ let scanRoot;
  /** @type {string} */ let rootArg;
  /** @type {string} */ let repoRoot;
  /** @type {string[]} */ let extensions;
  /** @type {Set<string>} */ let packIds = new Set();
  /** @type {PackToken[]} */ let packTokens = [];
  /** @type {AllowlistEntry[]} */ let allowlist = [];
  /** @type {string | undefined} */ let packsDir;
  /** @type {string | undefined} */ let allowlistFile;
  try {
    const args = parseArgs(argv);
    const root = args.get("--root");
    const ext = args.get("--ext");
    if (root === undefined) throw new UsageError("--root <dir> is required");
    if (ext === undefined) throw new UsageError("--ext <list> is required");
    extensions = parseExtensions(ext);
    rootArg = root;
    scanRoot = resolve(root);
    if (!isDirectory(scanRoot)) throw new UsageError(`--root ${root} is not a directory`);
    repoRoot = resolve(args.get("--repo-root") ?? process.cwd());
    if (!isDirectory(repoRoot)) throw new UsageError(`--repo-root ${args.get("--repo-root")} is not a directory`);
    const packs = args.get("--packs");
    if (packs !== undefined) {
      packsDir = resolve(packs);
      packIds = readPackIds(packsDir);
    }
    const tokens = args.get("--tokens");
    if (tokens !== undefined) packTokens = await loadTokens(resolve(tokens));
    const allowlistArg = args.get("--allowlist");
    if (allowlistArg !== undefined) {
      allowlistFile = resolve(allowlistArg);
      allowlist = await loadAllowlist(allowlistFile);
    }
  } catch (err) {
    if (!(err instanceof LintError)) throw err;
    console.error(`pack-lint: ${err.message}`);
    if (err instanceof UsageError) console.error(USAGE);
    return 2;
  }

  /** @type {{ loc: string, cls: string, token: string, why: string, line: string }[]} */
  const findings = [];
  let filesScanned = 0;
  for await (const file of walk(scanRoot, extensions)) {
    filesScanned++;
    const relPath = relative(repoRoot, file).split(sep).join("/");
    const lines = (await readFile(file, "utf8")).split(/\r?\n/);
    lines.forEach((line, i) => {
      const loc = `${relPath}:${i + 1}`;
      /**
       * @param {string} cls
       * @param {string} token
       * @param {string} why
       */
      const record = (cls, token, why) => {
        if (!isAllowed(allowlist, relPath, cls, token)) {
          findings.push({ loc, cls, token, why, line: line.trim().slice(0, 120) });
        }
      };
      // country-code: an exact quoted literal — uppercase ISO codes, and lowercase pack ids
      // (`packId == "de"` dispatch is the flagship leakage vector)
      for (const m of line.matchAll(/"([A-Z]{2,3})"/g)) {
        if (ALPHA2.has(m[1]) || ALPHA3.has(m[1])) {
          record("country-code", m[1], "ISO 3166-1 country code as string literal");
        }
      }
      for (const m of line.matchAll(/"([a-z]{2})"/g)) {
        if (packIds.has(m[1])) {
          record("country-code", m[1], "pack id as string literal (country dispatch in core)");
        }
      }
      // iso-marker: locale literals and explicit ISO 3166 mentions
      for (const m of line.matchAll(/"([a-z]{2}[-_][A-Z]{2})"/g)) {
        record("iso-marker", m[1], "locale literal");
      }
      if (/ISO\s?3166/.test(line)) {
        record("iso-marker", "ISO 3166", "ISO 3166 mention");
      }
      // pack-field: the app's distinctive pack tokens, in each listed spelling
      for (const { token, spellings } of packTokens) {
        if (spellings.some((spelling) => line.includes(spelling))) {
          record("pack-field", token, "pack-schema field accessed outside packs/");
        }
      }
    });
  }

  if (filesScanned === 0) {
    console.error(`pack-lint: 0 files scanned under ${rootArg} — refusing to report clean on an empty scan.`);
    return 1;
  }

  if (findings.length > 0) {
    console.error(`pack-lint: ${findings.length} country-literal finding(s) in ${filesScanned} file(s) scanned:`);
    for (const f of findings) {
      console.error(`  [${f.cls}] ${f.loc} token="${f.token}" — ${f.why}\n    ${f.line}`);
    }
    const packsHint = packsDir === undefined ? "the packs" : `${display(packsDir)}/`;
    const allowlistHint = allowlistFile === undefined ? "--allowlist <file.json>" : display(allowlistFile);
    console.error(
      `\nFix: move country-variable behavior into ${packsHint}, or add a justified allowlist entry (${allowlistHint}).`,
    );
    return 1;
  }
  console.log(
    `pack-lint: clean (${filesScanned} file(s) scanned, ${packTokens.length} pack tokens guarded, ${allowlist.length} allowlist entr(y/ies))`,
  );
  return 0;
}

/** True when Node runs this file itself, not when another module imports it. */
function isEntryPoint() {
  const script = process.argv[1];
  if (!script) return false;
  try {
    const invoked = realpathSync(script);
    const here = realpathSync(fileURLToPath(import.meta.url));
    return process.platform === "win32" ? invoked.toLowerCase() === here.toLowerCase() : invoked === here;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = await main(process.argv.slice(2));
}
