#!/usr/bin/env node
// Design-token generator (Story 1.7, AC 1 — AR-20/UX-DR1): DESIGN.md frontmatter is the
// ONE source; this emits the NativeWind theme, Hosted Page CSS custom properties, and
// the QuestPDF style class. Hand-copied token values are review-rejectable.
//
//   node generate-tokens.mjs          regenerate all outputs in place
//   node generate-tokens.mjs --check  regenerate to memory and diff against committed
//                                     outputs; exit 1 on drift, exit 2 on generator error
//
// Outputs are byte-stable (LF, no timestamps). All reads/compares normalize CRLF -> LF
// so a core.autocrlf checkout can never fake drift (1.1 LF lesson, hardened at review).
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const tokensDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(tokensDir, "..", "..");
const checkMode = process.argv.includes("--check");

const SOURCE = join(repoRoot, "_bmad-output", "planning-artifacts", "ux-designs", "ux-vuco-2026-07-15", "DESIGN.md");
const SOURCE_REL = "_bmad-output/planning-artifacts/ux-designs/ux-vuco-2026-07-15/DESIGN.md";

function fail(msg) {
  console.error(`generate-tokens: ${msg}`);
  process.exit(2);
}
const lf = (s) => s.replace(/\r\n/g, "\n");

// ---- load source -----------------------------------------------------------
const designMd = lf(await readFile(SOURCE, "utf8").catch(() => fail(`cannot read source ${SOURCE_REL}`)));
const fmMatch = designMd.match(/^---\n([\s\S]*?)\n---\n/);
if (!fmMatch) fail("DESIGN.md has no YAML frontmatter");
let fm;
try {
  fm = YAML.parse(fmMatch[1]) ?? {};
} catch (err) {
  fail(`frontmatter is not valid YAML — ${err.message}`);
}
for (const key of ["colors", "typography", "rounded", "spacing", "components"]) {
  if (!fm[key] || typeof fm[key] !== "object") fail(`frontmatter is missing the '${key}' block`);
}
if (!fm.typography.money) fail("typography must define the money role (AR-24)");
const sourceHash = createHash("sha256").update(fmMatch[1]).digest("hex").slice(0, 12);

let verdict;
try {
  verdict = JSON.parse(lf(await readFile(join(tokensDir, "font-verdict.json"), "utf8")));
} catch (err) {
  fail(`font-verdict.json missing or malformed (${err.message}) — run check-tnum.mjs first (AR-24: the money font is verified, never assumed)`);
}
if (typeof verdict.tnumConfirmed !== "boolean" || !verdict.moneyFontFamily || !verdict.moneyFontPostscript) {
  fail("font-verdict.json is malformed (need tnumConfirmed, moneyFontFamily, moneyFontPostscript)");
}

// ---- reference resolution --------------------------------------------------
// components use '{group.key}' references (whole-string or embedded, e.g. '1.5px {colors.border-input}').
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
const components = {};
for (const [comp, props] of Object.entries(fm.components)) {
  components[comp] = {};
  for (const [prop, v] of Object.entries(props)) {
    components[comp][prop] = resolveRefs(v, `components.${comp}.${prop}`);
  }
}

// ---- role -> weight -> face mapping (ONE table, per-renderer names) ----------
// pdfFamily: static non-RIBBI weights register as their OWN family in Skia/QuestPDF
// (verified from the font files themselves — see font-verdict.json families).
const WEIGHT_TO_FACE = {
  400: { rn: "PlusJakartaSans-Regular", pdfFamily: "Plus Jakarta Sans" },
  500: { rn: "PlusJakartaSans-Medium", pdfFamily: "Plus Jakarta Sans Medium" },
  600: { rn: "PlusJakartaSans-SemiBold", pdfFamily: "Plus Jakarta Sans SemiBold" },
  700: { rn: "PlusJakartaSans-Bold", pdfFamily: "Plus Jakarta Sans" },
  800: { rn: "PlusJakartaSans-ExtraBold", pdfFamily: "Plus Jakarta Sans ExtraBold" },
};
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
  `GENERATED from ${SOURCE_REL} (frontmatter sha256:${sourceHash}) — DO NOT EDIT.`,
  `Regenerate: node design/tokens/generate-tokens.mjs   (AR-20: hand-copied values are review-rejectable)`,
  `Money-role font per font-verdict.json: ${roles.money.cssFamily} (tnum ${verdict.tnumConfirmed ? "confirmed" : "NOT confirmed"} ${verdict.verifiedOn})`,
];
const jsHeader = headerLines.map((l) => `// ${l}`).join("\n") + "\n";
const cssHeader = headerLines.map((l) => `/* ${l} */`).join("\n") + "\n";

// ---- output 1: NativeWind theme ---------------------------------------------
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
const outputs = [
  { path: join(tokensDir, "out", "nativewind-theme.cjs"), content: nativewindOut },
  { path: join(repoRoot, "server", "src", "Vuco.Api", "wwwroot", "css", "tokens.css"), content: cssOut },
  { path: join(tokensDir, "out", "VucoDesignTokens.g.cs"), content: csOut },
];

let stale = 0;
for (const { path, content } of outputs) {
  const rel = relative(repoRoot, path).split(sep).join("/");
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
  console.error(`\ngenerate-tokens --check: ${stale} output(s) stale relative to ${SOURCE_REL}. Run: node design/tokens/generate-tokens.mjs`);
  process.exit(1);
}
if (checkMode) console.log("\ngenerate-tokens --check: all outputs current.");
