// The brand rows of the Story 15.1 I/O matrix (brand merge, brand gap, bad brand flag), plus the
// generator's argument and staleness contracts. Every generator run that can write happens in a
// throw-away copy of tokens/ under the git-ignored .test-tmp/ (inside the repository, so `yaml` still
// resolves); an interrupted run leaves nothing trackable in tokens/.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeBrand } from "../tokens/generate-tokens.mjs";

const kitRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensDir = join(kitRoot, "tokens");
const OUTPUTS = ["nativewind-theme.cjs", "tokens.css", "VucoDesignTokens.g.cs"];
const vucoBrand = readFileSync(join(tokensDir, "brands", "vuco.yaml"), "utf8");

const tmpRoot = join(kitRoot, ".test-tmp");
/** @type {string[]} */
const copies = [];
after(() => {
  for (const dir of copies) rmSync(dir, { recursive: true, force: true });
});

/**
 * A throw-away copy of tokens/ with its own generator (fonts left out: the generator reads only the
 * verdict), so a run can write only inside the copy.
 */
function tokensCopy() {
  mkdirSync(tmpRoot, { recursive: true });
  const root = mkdtempSync(join(tmpRoot, "run-"));
  copies.push(root);
  const tokens = join(root, "tokens");
  cpSync(tokensDir, tokens, { recursive: true, filter: (source) => basename(source) !== "fonts" });
  /** @param {string[]} args */
  const generate = (...args) =>
    spawnSync(process.execPath, [join(tokens, "generate-tokens.mjs"), ...args], { encoding: "utf8" });
  return { tokens, out: join(tokens, "out"), generate };
}

/**
 * Every path under an out/ directory with its bytes: equal before and after proves a run wrote nothing.
 * @param {string} outDir
 */
function snapshot(outDir) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const rel of readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
    const path = join(outDir, rel);
    result[rel] = statSync(path).isDirectory() ? "(dir)" : readFileSync(path, "base64");
  }
  return result;
}

/** @param {string} key */
const quotedKey = (key) => new RegExp(`'${key.replaceAll(".", "\\.")}'`);

/**
 * A brand file that must be refused: exit 2, the key named, nothing written.
 * @param {string} yaml
 * @param {string} key
 */
function assertRefused(yaml, key) {
  const copy = tokensCopy();
  writeFileSync(join(copy.tokens, "brands", "candidate.yaml"), yaml);
  const before = snapshot(copy.out);
  const run = copy.generate("--brand", "candidate");
  assert.equal(run.status, 2, run.stderr);
  assert.match(run.stderr, quotedKey(key));
  assert.deepEqual(snapshot(copy.out), before);
}

test("mergeBrand fills every null slot, in base order", () => {
  const merged = mergeBrand(
    { colors: { ink: "#111111", primary: null, "primary-dark": null, line: "#222222" }, rounded: { sm: "8px" } },
    { colors: { "primary-dark": "#00BB00", primary: "#00AA00" } },
  );
  assert.deepEqual(merged, {
    colors: { ink: "#111111", primary: "#00AA00", "primary-dark": "#00BB00", line: "#222222" },
    rounded: { sm: "8px" },
  });
  // deepEqual ignores key order; the generated outputs do not.
  assert.deepEqual(Object.keys(/** @type {object} */ (merged.colors)), ["ink", "primary", "primary-dark", "line"]);
});

test("mergeBrand names a null slot the brand leaves empty", () => {
  assert.throws(
    () => mergeBrand({ colors: { primary: null, accent: null } }, { colors: { primary: "#00AA00" } }),
    /'colors\.accent'/,
  );
  assert.throws(() => mergeBrand({ colors: { primary: null } }, { colors: { primary: null } }), /'colors\.primary'/);
});

test("mergeBrand names a brand key that has no null slot", () => {
  assert.throws(
    () => mergeBrand({ colors: { ink: "#111111", primary: null } }, { colors: { primary: "#00AA00", ink: "#000000" } }),
    /'colors\.ink'/,
  );
  assert.throws(
    () => mergeBrand({ colors: { primary: null } }, { colors: { primary: "#00AA00" }, shadows: { sm: "1px" } }),
    /'shadows'/,
  );
});

test("mergeBrand accepts only non-empty strings in slots, and #RRGGBB in colour slots", () => {
  const base = { colors: { primary: null }, typography: { money: { fontFamily: null } } };
  const good = { colors: { primary: "#00AA00" }, typography: { money: { fontFamily: "Plus Jakarta Sans" } } };
  assert.doesNotThrow(() => mergeBrand(base, good));
  /** @type {Array<[Record<string, unknown>, string]>} */
  const refused = [
    [{ ...good, colors: { primary: { hex: "#00AA00" } } }, "colors.primary"],
    [{ ...good, colors: { primary: "" } }, "colors.primary"],
    [{ ...good, colors: { primary: "#0A0" } }, "colors.primary"],
    [{ ...good, colors: { primary: "petrol" } }, "colors.primary"],
    [{ ...good, typography: { money: { fontFamily: " " } } }, "typography.money.fontFamily"],
    [{ ...good, typography: { money: { fontFamily: 700 } } }, "typography.money.fontFamily"],
  ];
  for (const [brand, key] of refused) {
    assert.throws(() => mergeBrand(base, brand), quotedKey(key), JSON.stringify(brand));
  }
});

test("--brand vuco reproduces the committed tokens/out/vuco byte for byte", () => {
  // Read-only on the real tree: --check never writes.
  const run = spawnSync(process.execPath, [join(tokensDir, "generate-tokens.mjs"), "--check", "--brand", "vuco"], {
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
});

test("--check exits 1 and names the output when a committed output differs", () => {
  const copy = tokensCopy();
  appendFileSync(join(copy.out, "vuco", "tokens.css"), "/* hand edit */\n");
  const run = copy.generate("--check", "--brand", "vuco");
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /^STALE {2}tokens\/out\/vuco\/tokens\.css /m);
  assert.doesNotMatch(run.stderr, /STALE {2}tokens\/out\/vuco\/(nativewind-theme\.cjs|VucoDesignTokens\.g\.cs)/);
});

test("a brand is written to tokens/out/<brand>/: header names its file, body equals vuco's", () => {
  const copy = tokensCopy();
  writeFileSync(join(copy.tokens, "brands", "copy.yaml"), vucoBrand);
  const run = copy.generate("--brand", "copy");
  assert.equal(run.status, 0, run.stderr);
  for (const file of OUTPUTS) {
    const [line1, , ...body] = readFileSync(join(copy.out, "copy", file), "utf8").split("\n");
    const [, , ...vucoBody] = readFileSync(join(tokensDir, "out", "vuco", file), "utf8").split("\n");
    assert.match(line1, /tokens\/brands\/copy\.yaml/, file);
    assert.deepEqual(body, vucoBody, file);
  }
});

test("a brand that leaves a null slot empty exits 2 naming it, and writes nothing", () => {
  const gap = vucoBrand.replace(/^ {2}accent: .*\n/m, "");
  assert.notEqual(gap, vucoBrand);
  assertRefused(gap, "colors.accent");
});

test("a brand key with no null slot exits 2 naming it, and writes nothing", () => {
  const extra = vucoBrand.replace(/^colors:\n/m, "colors:\n  ink-primary: '#000000'\n");
  assert.notEqual(extra, vucoBrand);
  assertRefused(extra, "colors.ink-primary");
});

test("a brand slot holding a malformed colour exits 2 naming it, and writes nothing", () => {
  const malformed = vucoBrand.replace(/^ {2}accent: .*$/m, "  accent: '#EA58'");
  assert.notEqual(malformed, vucoBrand);
  assertRefused(malformed, "colors.accent");
});

test("a missing, empty, malformed or unknown --brand exits 2 and writes nothing", () => {
  const copy = tokensCopy();
  const before = snapshot(copy.out);
  for (const args of [[], ["--check"], ["--brand"], ["--brand", "--check"], ["--brand", "../vuco"], ["--brand", "nope"]]) {
    const run = copy.generate(...args);
    assert.equal(run.status, 2, `[${args.join(" ")}] ${run.stderr}`);
  }
  assert.deepEqual(snapshot(copy.out), before);
});

test("an unknown argument exits 2 naming it and writes nothing, so a typo cannot switch --check off", () => {
  const copy = tokensCopy();
  // A marker that a write-mode run would overwrite: rewriting identical bytes would look like no write.
  appendFileSync(join(copy.out, "vuco", "tokens.css"), "/* marker */\n");
  const before = snapshot(copy.out);
  const run = copy.generate("--chek", "--brand", "vuco");
  assert.equal(run.status, 2, run.stderr);
  assert.match(run.stderr, /unknown argument\(s\): --chek/);
  assert.deepEqual(snapshot(copy.out), before);
});
