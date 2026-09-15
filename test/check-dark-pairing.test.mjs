// The dark-pairing row of the Story 15.1 I/O matrix, plus the CLI contract around it.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "tokens", "check-dark-pairing.mjs");
const scratch = mkdtempSync(join(tmpdir(), "kit-dark-pairing-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

/** @param {string[]} args */
const check = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

let fixtures = 0;
/**
 * Checks a source tree holding one screen file against the default (vuco) theme.
 * @param {string} tsx
 * @param {Record<string, string>} [allowlist]
 */
function scan(tsx, allowlist = {}) {
  const dir = join(scratch, String(fixtures++));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "Screen.tsx"), tsx);
  writeFileSync(join(dir, "allowlist.json"), JSON.stringify(allowlist));
  return check("--src", join(dir, "src"), "--allowlist", join(dir, "allowlist.json"));
}

test("a token whose theme key is unquoted (primary), used without its -dark twin, exits 1", () => {
  const run = scan('export const S = () => <Text className="font-body text-primary">x</Text>;\n');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Screen\.tsx: text-primary {2}\(needs dark:text-primary-dark\)/);
});

test("the same token paired with its -dark twin passes, with all 22 dual-mode tokens loaded", () => {
  const run = scan('export const S = () => <Text className="font-body text-primary dark:text-primary-dark">x</Text>;\n');
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^OK: every use of the 22 dual-mode colour tokens/);
});

test("quoted-key tokens stay covered, variant chain included", () => {
  const run = scan("const c = on ? 'placeholder:text-ink-secondary dark:text-ink-secondary-dark' : 'bg-surface-raised';\n");
  assert.equal(run.status, 1);
  assert.match(run.stderr, /placeholder:text-ink-secondary {2}/);
  assert.match(run.stderr, /bg-surface-raised {2}/);
});

test("an allowlisted file is skipped; an entry with no reason, or no file, fails", () => {
  const unpaired = 'export const S = () => <View className="bg-accent" />;\n';
  assert.equal(scan(unpaired, { "Screen.tsx": "Paper: white in both app themes." }).status, 0);
  assert.equal(scan(unpaired, { "Screen.tsx": " " }).status, 1);
  assert.equal(scan("export const S = () => null;\n", { "Gone.tsx": "Removed screen." }).status, 1);
});

test("a missing --src or --allowlist is a usage error (exit 2), not a verdict", () => {
  assert.equal(check().status, 2);
  assert.equal(check("--src", scratch).status, 2);
  assert.equal(check("--allowlist", join(scratch, "none.json")).status, 2);
});
