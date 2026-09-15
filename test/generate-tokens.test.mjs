// The brand rows of the Story 15.1 I/O matrix: brand merge, brand gap, bad brand flag.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { mergeBrand } from "../tokens/generate-tokens.mjs";

const tokensDir = join(dirname(fileURLToPath(import.meta.url)), "..", "tokens");
const outDir = join(tokensDir, "out");
const OUTPUTS = ["nativewind-theme.cjs", "tokens.css", "VucoDesignTokens.g.cs"];
const vucoBrand = readFileSync(join(tokensDir, "brands", "vuco.yaml"), "utf8");

/** @param {string[]} args */
const generate = (...args) =>
  spawnSync(process.execPath, [join(tokensDir, "generate-tokens.mjs"), ...args], { encoding: "utf8" });

/** Every path under tokens/out with its bytes: equal before and after proves a run wrote nothing. */
function outSnapshot() {
  /** @type {Record<string, string>} */
  const snapshot = {};
  for (const rel of readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
    const path = join(outDir, rel);
    snapshot[rel] = statSync(path).isDirectory() ? "(dir)" : readFileSync(path, "base64");
  }
  return snapshot;
}

/**
 * Runs the generator for a throw-away brand file and hands the result to `inspect` while the
 * run's output still exists; then removes the brand file and anything the run wrote.
 * @param {string} name
 * @param {string} yaml
 * @param {(run: import("node:child_process").SpawnSyncReturns<string>) => void} inspect
 */
function withBrand(name, yaml, inspect) {
  const brandFile = join(tokensDir, "brands", `${name}.yaml`);
  writeFileSync(brandFile, yaml);
  try {
    inspect(generate("--brand", name));
  } finally {
    rmSync(brandFile, { force: true });
    rmSync(join(outDir, name), { recursive: true, force: true });
  }
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

test("--brand vuco reproduces the committed tokens/out/vuco byte for byte", () => {
  const run = generate("--check", "--brand", "vuco");
  assert.equal(run.status, 0, run.stderr);
});

test("a brand is written to tokens/out/<brand>/: header names its file, body equals vuco's", () => {
  withBrand("zz-test-copy", vucoBrand, (run) => {
    assert.equal(run.status, 0, run.stderr);
    for (const file of OUTPUTS) {
      const [line1, , ...body] = readFileSync(join(outDir, "zz-test-copy", file), "utf8").split("\n");
      const [, , ...vucoBody] = readFileSync(join(outDir, "vuco", file), "utf8").split("\n");
      assert.match(line1, /tokens\/brands\/zz-test-copy\.yaml/, file);
      assert.deepEqual(body, vucoBody, file);
    }
  });
});

test("a brand that leaves a null slot empty exits 2 naming it, and writes nothing", () => {
  const gap = vucoBrand.replace(/^ {2}accent: .*\n/m, "");
  assert.notEqual(gap, vucoBrand);
  const before = outSnapshot();
  withBrand("zz-test-gap", gap, (run) => {
    assert.equal(run.status, 2);
    assert.match(run.stderr, /'colors\.accent'/);
    assert.deepEqual(outSnapshot(), before);
  });
});

test("a brand key with no null slot exits 2 naming it, and writes nothing", () => {
  const extra = vucoBrand.replace(/^colors:\n/m, "colors:\n  ink-primary: '#000000'\n");
  assert.notEqual(extra, vucoBrand);
  const before = outSnapshot();
  withBrand("zz-test-extra", extra, (run) => {
    assert.equal(run.status, 2);
    assert.match(run.stderr, /'colors\.ink-primary'/);
    assert.deepEqual(outSnapshot(), before);
  });
});

test("a missing, empty, malformed or unknown --brand exits 2 and writes nothing", () => {
  const before = outSnapshot();
  for (const args of [[], ["--check"], ["--brand"], ["--brand", "--check"], ["--brand", "../vuco"], ["--brand", "nope"]]) {
    const run = generate(...args);
    assert.equal(run.status, 2, `[${args.join(" ")}] ${run.stderr}`);
  }
  assert.deepEqual(outSnapshot(), before);
});
