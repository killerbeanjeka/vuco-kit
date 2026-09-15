#!/usr/bin/env node
// Design-token generator (Story 1.7, AC 1 — AR-20/UX-DR1): tokens/base.tokens.yaml, completed by
// one brand file (tokens/brands/<brand>.yaml), is the ONE source; this emits the NativeWind theme,
// Hosted Page CSS custom properties, and the QuestPDF style class into tokens/out/<brand>/.
// Hand-copied token values are review-rejectable.
//
//   node tokens/generate-tokens.mjs --brand <name>          regenerate all outputs in place
//   node tokens/generate-tokens.mjs --brand <name> --check  regenerate to memory and diff against
//                                                           committed outputs; exit 1 on drift,
//                                                           exit 2 on generator error
//
// An unknown argument, a missing, malformed or unknown --brand, and a brand that does not fit the
// base (a null slot left empty or filled with anything but a non-empty string, #RRGGBB in colour
// slots, or a key with no null slot to fill) are generator errors: exit 2, nothing written.
//
// Outputs are byte-stable (LF, no timestamps). All reads/compares normalize CRLF -> LF
// so a core.autocrlf checkout can never fake drift (1.1 LF lesson, hardened at review).
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const tokensDir = dirname(fileURLToPath(import.meta.url));
const kitRoot = join(tokensDir, "..");

/**
 * @param {string} msg
 * @returns {never}
 */
function fail(msg) {
  console.error(`generate-tokens: ${msg}`);
  process.exit(2);
}
/** @param {string} s */
const lf = (s) => s.replace(/\r\n/g, "\n");
/** @param {unknown} err */
const reason = (err) => (err instanceof Error ? err.message : String(err));

// ---- brand merge ---------------------------------------------------------------
/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isGroup = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Completes the base token set with one brand. A brand fills exactly the base's `null` slots, each
 * with a non-empty string (`#RRGGBB` in colour slots): a slot left empty or filled with anything else,
 * and a key with no slot to fill, are errors, all named in one throw.
 * The walk follows BASE key order, so each brand value lands where its slot sits and the outputs
 * keep their bytes — a `{ ...base, ...brand }` spread would append the brand values instead and
 * reorder all three outputs.
 *
 * @param {Record<string, unknown>} base   parsed tokens/base.tokens.yaml
 * @param {Record<string, unknown>} brand  parsed tokens/brands/<name>.yaml
 * @returns {Record<string, unknown>}      the merged token set, in base key order
 */
export function mergeBrand(base, brand) {
  /** @type {string[]} */
  const problems = [];
  const merged = fillSlots(base, brand, "", problems);
  if (problems.length) throw new Error(problems.join("; "));
  return merged;
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} brand
 * @param {string} path
 * @param {string[]} problems
 * @returns {Record<string, unknown>}
 */
function fillSlots(base, brand, path, problems) {
  /** @param {string} key */
  const at = (key) => (path ? `${path}.${key}` : key);
  /** @type {Record<string, unknown>} */
  const merged = {};
  for (const [key, value] of Object.entries(base)) {
    const supplied = Object.hasOwn(brand, key) ? brand[key] : undefined;
    if (value === null) {
      if (supplied === undefined || supplied === null) {
        problems.push(`base slot '${at(key)}' is not filled by the brand`);
      } else if (typeof supplied !== "string" || supplied.trim() === "") {
        problems.push(`base slot '${at(key)}' needs a non-empty string, got ${JSON.stringify(supplied)}`);
      } else if (at(key).startsWith("colors.") && !/^#[0-9A-Fa-f]{6}$/.test(supplied)) {
        problems.push(`colour slot '${at(key)}' needs #RRGGBB, got ${JSON.stringify(supplied)}`);
      }
      merged[key] = supplied ?? null;
    } else if (isGroup(value)) {
      if (supplied !== undefined && supplied !== null && !isGroup(supplied)) {
        problems.push(`brand key '${at(key)}' has no null slot in the base`);
      }
      merged[key] = fillSlots(value, isGroup(supplied) ? supplied : {}, at(key), problems);
    } else {
      if (supplied !== undefined) problems.push(`brand key '${at(key)}' has no null slot in the base`);
      merged[key] = value;
    }
  }
  for (const key of Object.keys(brand)) {
    if (!Object.hasOwn(base, key)) problems.push(`brand key '${at(key)}' has no null slot in the base`);
  }
  return merged;
}

// ---- CLI ------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  // An unknown argument is an error: a typo such as --chek would otherwise run write mode and exit 0,
  // silently switching the staleness gate off.
  /** @type {string[]} */
  const unknown = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--check") continue;
    if (args[i] === "--brand") {
      i++; // its value
      continue;
    }
    unknown.push(args[i]);
  }
  if (unknown.length) fail(`unknown argument(s): ${unknown.join(" ")} (usage: --brand <name> [--check])`);
  const checkMode = args.includes("--check");
  const brandAt = args.indexOf("--brand");
  const brand = brandAt > -1 ? args[brandAt + 1] : undefined;
  if (brand === undefined || brand.startsWith("-")) fail("--brand <name> is required (a file tokens/brands/<name>.yaml)");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(brand)) fail(`--brand '${brand}' is not a brand name (lowercase letters, digits, dashes)`);

  const BASE_REL = "tokens/base.tokens.yaml";
  const BRAND_REL = `tokens/brands/${brand}.yaml`;

  // ---- load source -----------------------------------------------------------
  const baseText = lf(await readFile(join(kitRoot, BASE_REL), "utf8").catch(() => fail(`cannot read source ${BASE_REL}`)));
  const brandText = lf(
    await readFile(join(kitRoot, BRAND_REL), "utf8").catch(() => fail(`unknown brand '${brand}' — cannot read ${BRAND_REL}`)),
  );
  /**
   * @param {string} text
   * @param {string} rel
   * @returns {Record<string, unknown>}
   */
  const parse = (text, rel) => {
    /** @type {unknown} */
    let doc;
    try {
      doc = YAML.parse(text) ?? {};
    } catch (err) {
      fail(`${rel} is not valid YAML — ${reason(err)}`);
    }
    if (!isGroup(doc)) fail(`${rel} must be a YAML mapping`);
    return doc;
  };
  /** @type {any} YAML token data, shape-checked below */
  let fm;
  try {
    fm = mergeBrand(parse(baseText, BASE_REL), parse(brandText, BRAND_REL));
  } catch (err) {
    fail(`${BRAND_REL} does not fit ${BASE_REL} — ${reason(err)}`);
  }
  for (const key of ["colors", "typography", "rounded", "spacing", "components"]) {
    if (!fm[key] || typeof fm[key] !== "object") fail(`token set is missing the '${key}' block`);
  }
  if (!fm.typography.money) fail("typography must define the money role (AR-24)");
  const sourceHash = createHash("sha256").update(baseText).update(brandText).digest("hex").slice(0, 12);

  /** @type {any} */
  let verdict;
  try {
    verdict = JSON.parse(lf(await readFile(join(tokensDir, "font-verdict.json"), "utf8")));
  } catch (err) {
    fail(`font-verdict.json missing or malformed (${reason(err)}) — run check-tnum.mjs first (AR-24: the money font is verified, never assumed)`);
  }
  if (typeof verdict.tnumConfirmed !== "boolean" || !verdict.moneyFontFamily || !verdict.moneyFontPostscript) {
    fail("font-verdict.json is malformed (need tnumConfirmed, moneyFontFamily, moneyFontPostscript)");
  }

  // ---- reference resolution --------------------------------------------------
  // components use '{group.key}' references (whole-string or embedded, e.g. '1.5px {colors.border-input}').
  /**
   * @param {unknown} value
   * @param {string} path
   */
  function resolveRefs(value, path) {
    if (typeof value !== "string") return value;
    const resolved = value.replace(/\{([a-z]+)\.([a-z0-9-]+)\}/g, (_, group, key) => {
      if (group === "typography") {
        if (!(key in fm.typography)) fail(`${path}: dangling reference {typography.${key}}`);
        return key; // typography refs resolve to the ROLE NAME
      }
      const groupObj = fm[group];
      if (!groupObj || !(key in groupObj)) fail(`${path}: dangling reference {${group}.${key}}`);
      if (groupObj[key] !== null && typeof groupObj[key] === "object") fail(`${path}: reference {${group}.${key}} resolves to an object, not a scalar`);
      return String(groupObj[key]);
    });
    const leftover = resolved.match(/\{[a-zA-Z0-9_.-]+\}/);
    if (leftover) fail(`${path}: unresolved reference ${leftover[0]} (unknown group or bad key syntax)`);
    return resolved;
  }
  /** @type {Record<string, Record<string, unknown>>} */
  const components = {};
  for (const [comp, props] of Object.entries(fm.components)) {
    components[comp] = {};
    for (const [prop, v] of Object.entries(/** @type {object} */ (props))) {
      components[comp][prop] = resolveRefs(v, `components.${comp}.${prop}`);
    }
  }

  // ---- role -> weight -> face mapping (ONE table, per-renderer names) ----------
  // pdfFamily: static non-RIBBI weights register as their OWN family in Skia/QuestPDF
  // (verified from the font files themselves — see font-verdict.json families).
  /** @type {Record<number, { rn: string, pdfFamily: string }>} */
  const WEIGHT_TO_FACE = {
    400: { rn: "PlusJakartaSans-Regular", pdfFamily: "Plus Jakarta Sans" },
    500: { rn: "PlusJakartaSans-Medium", pdfFamily: "Plus Jakarta Sans Medium" },
    600: { rn: "PlusJakartaSans-SemiBold", pdfFamily: "Plus Jakarta Sans SemiBold" },
    700: { rn: "PlusJakartaSans-Bold", pdfFamily: "Plus Jakarta Sans" },
    800: { rn: "PlusJakartaSans-ExtraBold", pdfFamily: "Plus Jakarta Sans ExtraBold" },
  };
  /** @type {Record<string, { cssFamily: string, rnFamily: string, pdfFamily: string, weight: number, sizePx: number, lineHeight: number, letterSpacing: string | null }>} */
  const roles = {};
  for (const [role, def] of Object.entries(fm.typography)) {
    const face = WEIGHT_TO_FACE[def.fontWeight];
    if (!face) fail(`typography.${role}: no static face for weight ${def.fontWeight} — extend WEIGHT_TO_FACE and bundle the file`);
    const sizePx = parseFloat(def.fontSize);
    if (Number.isNaN(sizePx)) fail(`typography.${role}: invalid fontSize '${def.fontSize}'`);
    roles[role] = {
      cssFamily: def.fontFamily,
      rnFamily: face.rn,
      pdfFamily: face.pdfFamily,
      weight: def.fontWeight,
      sizePx,
      lineHeight: def.lineHeight ?? 1.0,
      letterSpacing: def.letterSpacing ?? null,
    };
  }
  // Money role comes FROM THE VERDICT (AR-24) — never hardcoded. While the verdict says
  // Plus Jakarta Sans this is a pass-through; any other family must fail loud until its
  // faces are actually bundled + @font-face'd (a silent fallback would violate AD-14).
  if (verdict.moneyFontFamily !== "Plus Jakarta Sans") {
    fail(`font-verdict.json names money font '${verdict.moneyFontFamily}', but only Plus Jakarta Sans faces are bundled/emitted — bundle the fallback faces and extend the generator before accepting this verdict`);
  }
  roles.money.cssFamily = verdict.moneyFontFamily;
  roles.money.rnFamily = verdict.moneyFontPostscript;

  const headerLines = [
    `GENERATED from ${BASE_REL} + ${BRAND_REL} (sha256:${sourceHash}) — DO NOT EDIT.`,
    `Regenerate in @vuco/kit: node tokens/generate-tokens.mjs --brand ${brand}   (AR-20: hand-copied values are review-rejectable)`,
    `Money-role font per font-verdict.json: ${roles.money.cssFamily} (tnum ${verdict.tnumConfirmed ? "confirmed" : "NOT confirmed"} ${verdict.verifiedOn})`,
  ];
  const jsHeader = headerLines.map((l) => `// ${l}`).join("\n") + "\n";
  const cssHeader = headerLines.map((l) => `/* ${l} */`).join("\n") + "\n";

  // ---- output 1: NativeWind theme ---------------------------------------------
  /**
   * @param {object} obj
   * @param {number} indent
   * @returns {string}
   */
  function jsObject(obj, indent) {
    const pad = "  ".repeat(indent);
    const entries = Object.entries(obj).map(([k, v]) => {
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k}'`;
      if (Array.isArray(v)) return `${pad}  ${key}: ${JSON.stringify(v)},`;
      if (v !== null && typeof v === "object") return `${pad}  ${key}: ${jsObject(v, indent + 1)},`;
      return `${pad}  ${key}: ${JSON.stringify(v)},`;
    });
    return `{\n${entries.join("\n")}\n${pad}}`;
  }

  const nwTheme = {
    colors: Object.fromEntries(Object.entries(fm.colors)),
    fontFamily: Object.fromEntries(Object.entries(roles).map(([r, d]) => [r, [d.rnFamily]])),
    fontSize: Object.fromEntries(
      Object.entries(roles).map(([r, d]) => {
        /** @type {{ lineHeight: string, letterSpacing?: string }} */
        const opts = { lineHeight: String(d.lineHeight) };
        if (d.letterSpacing !== null) opts.letterSpacing = String(d.letterSpacing);
        return [r, [`${d.sizePx}px`, opts]];
      }),
    ),
    borderRadius: Object.fromEntries(Object.entries(fm.rounded).map(([k, v]) => [k, String(v)])),
    spacing: Object.fromEntries(Object.entries(fm.spacing).map(([k, v]) => [k, String(v)])),
  };
  // Money surfaces MUST render tabular figures: tnum is opt-in at every renderer, so the
  // requirement travels as data (fontVariant) instead of tribal knowledge.
  const rolesOut = Object.fromEntries(
    // Every money role (money, money-hero, …) carries tnum as DATA, not just the base one.
    Object.entries(roles).map(([r, d]) => [r, r.startsWith("money") ? { ...d, fontVariant: ["tabular-nums"] } : d]),
  );
  const nativewindOut = `${jsHeader}
// Consumed by apps/mobile/tailwind.config.js via theme.extend. The 'vuco' export carries
// component tokens (min-heights are MINIMUMS — they grow with fontScale, DESIGN.md rule).
// typographyRoles.money.fontVariant is REQUIRED on money text (tnum is opt-in in RN).
module.exports = {
  theme: ${jsObject(nwTheme, 1)},
  vuco: ${jsObject(components, 1)},
  typographyRoles: ${jsObject(rolesOut, 1)},
};
`;

  // ---- output 2: Hosted Page CSS ----------------------------------------------
  /**
   * @param {string} k
   * @param {unknown} v
   */
  const cssVar = (k, v) => `  --${k}: ${v};`;
  const lightColors = Object.entries(fm.colors).filter(([k]) => !k.endsWith("-dark"));
  const darkColors = Object.entries(fm.colors).filter(([k]) => k.endsWith("-dark"));
  const fontFaces = Object.entries(WEIGHT_TO_FACE)
    .map(
      ([weight, face]) => `@font-face {
  font-family: 'Plus Jakarta Sans';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${face.rn}.ttf') format('truetype');
}`,
    )
    .join("\n");

  const cssOut = `${cssHeader}
/* Self-hosted fonts (AD-14: no third-party requests from the customer's browser). */
${fontFaces}

/* Hosted Page ships light-only (UX decision); the dark block exists for completeness. */
:root {
${lightColors.map(([k, v]) => cssVar(`color-${k}`, v)).join("\n")}
${Object.entries(fm.rounded).map(([k, v]) => cssVar(`radius-${k}`, v)).join("\n")}
${Object.entries(fm.spacing).map(([k, v]) => cssVar(`space-${k}`, v)).join("\n")}
${Object.entries(roles).map(([r, d]) => cssVar(`font-${r}`, `${d.weight} ${d.sizePx}px/${d.lineHeight} '${d.cssFamily}', system-ui, sans-serif`)).join("\n")}
}

[data-theme='dark'] {
${darkColors.map(([k, v]) => cssVar(`color-${k.replace(/-dark$/, "")}`, v)).join("\n")}
}

/* Money surfaces MUST use this class: tabular figures are opt-in (tnum, AR-24). */
.vuco-money {
  font: var(--font-money);
  font-variant-numeric: tabular-nums;
}
`;

  // ---- output 3: QuestPDF style class -----------------------------------------
  /** @param {string} s */
  const pascal = (s) => {
    const id = s.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) fail(`'${s}' does not map to a valid C# identifier ('${id}')`);
    return id;
  };
  const csOut = `${jsHeader}
// Included by the document renderer when it lands (Story 5.3) — not compiled before that.
// Typography.Family values are the PER-WEIGHT Skia families (static non-RIBBI weights
// register as their own family — 'Plus Jakarta Sans Medium', not weight 500 of the base).
namespace Vuco.Documents;

public static class VucoDesignTokens
{
    public static class Colors
    {
${lightColors.map(([k, v]) => `        public const string ${pascal(k)} = "${v}";`).join("\n")}
    }

    public static class ColorsDark
    {
${darkColors.map(([k, v]) => `        public const string ${pascal(k.replace(/-dark$/, ""))} = "${v}";`).join("\n")}
    }

    public static class Typography
    {
${Object.entries(roles)
  .map(([r, d]) => `        public static readonly (string Family, float SizePx, int Weight, float LineHeight, float LetterSpacing) ${pascal(r)} = ("${d.pdfFamily}", ${d.sizePx}f, ${d.weight}, ${d.lineHeight}f, ${d.letterSpacing === null ? 0 : parseFloat(d.letterSpacing)}f);`)
  .join("\n")}
    }

    public static class Radii
    {
${Object.entries(fm.rounded).map(([k, v]) => `        public const float ${pascal(k)} = ${parseFloat(v)}f;`).join("\n")}
    }

    public static class Spacing
    {
${Object.entries(fm.spacing).map(([k, v]) => `        public const float S${k} = ${parseFloat(v)}f;`).join("\n")}
    }

    /// <summary>Money role font family — tnum-verified (AR-24, font-verdict.json).</summary>
    public const string MoneyFontFamily = "${roles.money.cssFamily}";

    /// <summary>Money text MUST enable this font feature (tnum is opt-in in QuestPDF).</summary>
    public const string MoneyFontFeature = "tnum";
}
`;

  // ---- write or check ----------------------------------------------------------
  const outDir = join(tokensDir, "out", brand);
  const outputs = [
    { path: join(outDir, "nativewind-theme.cjs"), content: nativewindOut },
    { path: join(outDir, "tokens.css"), content: cssOut },
    { path: join(outDir, "VucoDesignTokens.g.cs"), content: csOut },
  ];

  let stale = 0;
  for (const { path, content } of outputs) {
    const rel = relative(kitRoot, path).split(sep).join("/");
    if (checkMode) {
      const existing = await readFile(path, "utf8").catch(() => null);
      if (existing === null) {
        console.error(`STALE  ${rel} — missing (never generated?)`);
        stale++;
      } else if (lf(existing) !== content) {
        console.error(`STALE  ${rel} — differs from source-generated content`);
        stale++;
      } else {
        console.log(`ok     ${rel}`);
      }
    } else {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
      console.log(`wrote  ${rel}`);
    }
  }

  if (checkMode && stale) {
    console.error(`\ngenerate-tokens --check: ${stale} output(s) stale relative to ${BASE_REL} + ${BRAND_REL}. Run: node tokens/generate-tokens.mjs --brand ${brand}`);
    process.exit(1);
  }
  if (checkMode) console.log("\ngenerate-tokens --check: all outputs current.");
}

// A CLI only when run directly: importing this module (the tests import mergeBrand) generates nothing.
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  await main();
}
