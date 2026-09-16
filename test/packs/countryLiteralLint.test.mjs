// The lint rows of the Story 15.3 I/O matrix (bad arguments, malformed allowlist), plus the behaviour
// vuco's pack lint had before the move: the three classes, the report format, the empty-scan refusal and
// the allowlist. Each case builds its own tree under the OS temp directory and runs the real CLI.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { main } from "../../src/packs/countryLiteralLint.mjs";

const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "packs", "countryLiteralLint.mjs");
const scratch = mkdtempSync(join(tmpdir(), "kit-country-lint-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const TOKENS_MODULE = `export default async () => [
  { token: "taxRuleTable", spellings: ["taxRuleTable", "TaxRuleTable"] },
  { token: "seller_vat_id", spellings: ["seller_vat_id"] },
];
`;

let repos = 0;
/**
 * A throw-away repository: `files` (path -> content) under it, pack folders `de` and `fr` under packs/,
 * and a tokens module. Returns the repository root.
 * @param {Record<string, string>} files
 */
function repo(files) {
  const root = join(scratch, String(repos++));
  for (const id of ["de", "fr"]) mkdirSync(join(root, "packs", id), { recursive: true });
  writeFileSync(join(root, "tokens.mjs"), TOKENS_MODULE);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/**
 * Runs the CLI.
 * @param {string[]} args
 * @param {string} [cwd]
 */
function lint(args, cwd) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/**
 * The full flag set for a repository made by repo(), scanning its core/ folder.
 * @param {string} root
 * @param {string[]} [extra]
 */
const fullArgs = (root, extra = []) => [
  "--root", join(root, "core"),
  "--ext", ".cs",
  "--repo-root", root,
  "--packs", join(root, "packs"),
  "--tokens", join(root, "tokens.mjs"),
  ...extra,
];

test("each violation class is reported as [class] path:line token=… and exits 1", () => {
  const cases = [
    ["CountryCode.cs", 'var country = "DE";', "country-code", "DE", "ISO 3166-1 country code as string literal"],
    ["Alpha3.cs", 'const string Code = "DEU";', "country-code", "DEU", "ISO 3166-1 country code as string literal"],
    ["Alpha3NonEu.cs", 'const string Code = "UKR";', "country-code", "UKR", "ISO 3166-1 country code as string literal"],
    ["PackId.cs", 'if (pack.Id == "de") { }', "country-code", "de", "pack id as string literal (country dispatch in core)"],
    ["Locale.cs", 'var culture = "de-DE";', "iso-marker", "de-DE", "locale literal"],
    ["LocaleUnderscore.cs", 'var culture = "fr_FR";', "iso-marker", "fr_FR", "locale literal"],
    ["IsoMention.cs", "// mapping per ISO 3166 semantics", "iso-marker", "ISO 3166", "ISO 3166 mention"],
    ["PackField.cs", "var table = pack.taxRuleTable;", "pack-field", "taxRuleTable", "pack-schema field accessed outside packs/"],
    ["PascalField.cs", "var table = pack.TaxRuleTable;", "pack-field", "taxRuleTable", "pack-schema field accessed outside packs/"],
    ["PackKey.cs", 'if (missing.Contains("seller_vat_id")) { }', "pack-field", "seller_vat_id", "pack-schema field accessed outside packs/"],
  ];
  for (const [file, content, cls, token, why] of cases) {
    const root = repo({ [`core/${file}`]: `// header\n${content}\n` });
    const run = lint(fullArgs(root));
    assert.equal(run.code, 1, `${file}: ${run.stdout}${run.stderr}`);
    assert.ok(
      run.stderr.includes(`  [${cls}] core/${file}:2 token="${token}" — ${why}\n    ${content}\n`),
      `${file} should be reported as ${cls}:\n${run.stderr}`,
    );
    assert.match(run.stderr, /^pack-lint: 1 country-literal finding\(s\) in 1 file\(s\) scanned:/);
    assert.match(run.stderr, /Fix: move country-variable behavior into .*packs.*, or add a justified allowlist entry/);
  }
});

test("a clean tree exits 0 and says how much it checked", () => {
  const root = repo({
    "core/Clean.cs":
      'var env = "Development"; var notCode = "XX"; var lang = "en"; // "en" is no pack id here\r\n' +
      "var languages = supported; // not a pack token\r\n",
  });
  const run = lint(fullArgs(root));
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.stdout, "pack-lint: clean (1 file(s) scanned, 2 pack tokens guarded, 0 allowlist entr(y/ies))\n");
});

test("an empty scan exits 1 and says 0 files scanned, also when only skipped folders hold files", () => {
  /** @type {Record<string, string>[]} */
  const trees = [
    {},
    { "core/readme.md": "\"DE\"\n" },
    { "core/bin/Gen.cs": '"DE"\n', "core/obj/Gen.cs": '"DE"\n', "core/node_modules/pkg/Gen.cs": '"DE"\n' },
  ];
  for (const files of trees) {
    const root = repo(files);
    mkdirSync(join(root, "core"), { recursive: true });
    const run = lint(fullArgs(root));
    assert.equal(run.code, 1, run.stdout);
    assert.equal(
      run.stderr,
      `pack-lint: 0 files scanned under ${join(root, "core")} — refusing to report clean on an empty scan.\n`,
    );
  }
  // The message names --root as it was given.
  const relative = lint(["--root", "core", "--ext", ".cs"], repo({ "core/notes.txt": "" }));
  assert.equal(relative.code, 1);
  assert.match(relative.stderr, /^pack-lint: 0 files scanned under core — /);
});

test("--ext takes a comma-separated list, with or without the dot", () => {
  const root = repo({ "core/A.cs": "var ok = 1;\n", "core/B.ts": 'const c = "DE";\n', "core/C.md": '"DE"\n' });
  const csOnly = lint(fullArgs(root).map((arg) => (arg === ".cs" ? "cs" : arg)));
  assert.equal(csOnly.code, 0, csOnly.stderr);
  assert.match(csOnly.stdout, /clean \(1 file\(s\) scanned/);
  const both = lint(fullArgs(root).map((arg) => (arg === ".cs" ? ".cs,.ts" : arg)));
  assert.equal(both.code, 1);
  assert.match(both.stderr, /\[country-code\] core\/B\.ts:1 token="DE"/);
  assert.match(both.stderr, /in 2 file\(s\) scanned/);
});

test("the allowlist exempts by path glob, class and optional token, relative to --repo-root", () => {
  const root = repo({
    "core/Packs/Loader.cs": "var table = pack.taxRuleTable;\n",
    "core/Api/Page.cs": 'var label = "VAT"; var other = "AUT";\n',
    "core/Api/Stray.cs": "var table = pack.taxRuleTable;\n",
  });
  writeFileSync(
    join(root, "allowlist.json"),
    JSON.stringify({
      description: "ignored",
      entries: [
        { path: "core/Packs/**", class: "pack-field", reason: "the loader reads the pack" },
        { path: "core/*/Page.cs", class: "country-code", token: "VAT", reason: "the English tax label" },
      ],
    }),
  );
  const run = lint(fullArgs(root, ["--allowlist", join(root, "allowlist.json")]));
  assert.equal(run.code, 1);
  assert.match(run.stderr, /^pack-lint: 2 country-literal finding\(s\) in 3 file\(s\) scanned:/);
  assert.match(run.stderr, /\[country-code\] core\/Api\/Page\.cs:1 token="AUT"/, "a token-scoped entry exempts only its token");
  assert.match(run.stderr, /\[pack-field\] core\/Api\/Stray\.cs:1 token="taxRuleTable"/, "the same use outside the glob is flagged");
  assert.doesNotMatch(run.stderr, /Loader\.cs|token="VAT"/);
  assert.match(run.stderr, /add a justified allowlist entry \(.*allowlist\.json\)/);
});

test("a missing allowlist file means no exemptions", () => {
  const root = repo({ "core/Loader.cs": "var table = pack.taxRuleTable;\n" });
  const run = lint(fullArgs(root, ["--allowlist", join(root, "no-such-allowlist.json")]));
  assert.equal(run.code, 1, run.stderr);
  assert.match(run.stderr, /\[pack-field\] core\/Loader\.cs:1/);
});

test("--repo-root defaults to the working directory, and the optional flags may be left out", () => {
  const root = repo({ "core/X.cs": 'var c = "FR";\nvar id = "fr"; var t = pack.taxRuleTable;\n' });
  const run = lint(["--root", "core", "--ext", ".cs"], root);
  assert.equal(run.code, 1, run.stderr);
  assert.match(run.stderr, /\[country-code\] core\/X\.cs:1 token="FR"/);
  assert.doesNotMatch(run.stderr, /token="fr"|taxRuleTable/, "no --packs and no --tokens: those classes find nothing");
  assert.match(run.stderr, /into the packs, or add a justified allowlist entry \(--allowlist <file\.json>\)/);
});

test("bad arguments exit 2 with the usage line", () => {
  const root = repo({ "core/A.cs": "var ok = 1;\n" });
  const core = join(root, "core");
  const badTokens = join(root, "bad-tokens.mjs");
  writeFileSync(badTokens, 'export default () => [{ token: "x", spellings: [] }];\n');
  const noDefault = join(root, "no-default.mjs");
  writeFileSync(noDefault, "export const tokens = [];\n");
  // [arguments, message, whether the usage line follows]
  /** @type {[string[], string, boolean][]} */
  const cases = [
    [[], "--root <dir> is required", true],
    [["--ext", ".cs"], "--root <dir> is required", true],
    [["--root", core], "--ext <list> is required", true],
    [["--root", core, "--ext"], "--ext needs a value", true],
    [["--root", "--ext", ".cs"], "--root needs a value", true],
    [["--root", core, "--ext", ".cs", "--verbose", "yes"], "unknown argument --verbose", true],
    [["--root", core, "--ext", ".cs", "stray"], "unknown argument stray", true],
    [["--root", core, "--ext", ".cs", "--root", core], "--root is given twice", true],
    [["--root", join(root, "missing"), "--ext", ".cs"], "is not a directory", true],
    [["--root", core, "--ext", ","], "must list extensions", true],
    [["--root", core, "--ext", "*.cs"], "must list extensions", true],
    [["--root", core, "--ext", ".cs", "--repo-root", join(root, "missing")], "is not a directory", true],
    [["--root", core, "--ext", ".cs", "--packs", join(root, "missing")], "cannot read --packs", false],
    [["--root", core, "--ext", ".cs", "--tokens", join(root, "missing.mjs")], "cannot use --tokens", false],
    [["--root", core, "--ext", ".cs", "--tokens", noDefault], "its default export is not a function", false],
    [["--root", core, "--ext", ".cs", "--tokens", badTokens], "must return [{ token, spellings }]", false],
  ];
  for (const [args, message, usage] of cases) {
    const run = lint(args);
    assert.equal(run.code, 2, `${args.join(" ")}: ${run.stdout}${run.stderr}`);
    assert.ok(run.stderr.startsWith("pack-lint: ") && run.stderr.includes(message), `${args.join(" ")}:\n${run.stderr}`);
    const usageLine = /usage: node countryLiteralLint\.mjs --root <dir> --ext <list>/;
    assert.equal(usageLine.test(run.stderr), usage, `${args.join(" ")}: usage line expected ${usage}:\n${run.stderr}`);
    assert.equal(run.stdout, "");
  }
});

test("a malformed allowlist exits 2 and names the problem", () => {
  const root = repo({ "core/A.cs": "var ok = 1;\n" });
  const cases = [
    ["{ not json", "is not valid JSON"],
    ["null", 'must have an "entries" array'],
    [JSON.stringify({ entries: {} }), 'must have an "entries" array'],
    [JSON.stringify({ entries: ["core/**"] }), "entries[0] invalid — must be an object"],
    [JSON.stringify({ entries: [{ path: "", class: "pack-field", reason: "r" }] }), "entries[0] invalid — path must be a non-empty string"],
    [JSON.stringify({ entries: [{ path: "a", class: "country", reason: "r" }] }), "entries[0] invalid — class must be one of country-code | iso-marker | pack-field"],
    [JSON.stringify({ entries: [{ path: "a", class: "iso-marker" }] }), "entries[0] invalid — reason must be a non-empty string"],
    [
      JSON.stringify({ entries: [{ path: "a", class: "iso-marker", reason: "r" }, { path: "a", class: "iso-marker", token: "", reason: "r" }] }),
      "entries[1] invalid — token, when present, must be a non-empty string",
    ],
  ];
  for (const [content, message] of cases) {
    writeFileSync(join(root, "allowlist.json"), content);
    const run = lint(fullArgs(root, ["--allowlist", join(root, "allowlist.json")]));
    assert.equal(run.code, 2, `${content}: ${run.stdout}${run.stderr}`);
    assert.ok(run.stderr.startsWith("pack-lint: ") && run.stderr.includes(message), `${content}:\n${run.stderr}`);
    assert.doesNotMatch(run.stderr, /usage:/, "an allowlist problem is not a command-line problem");
  }
  // Only a missing file means "no exemptions"; one that exists but cannot be read is an error.
  const unreadable = lint(fullArgs(root, ["--allowlist", join(root, "packs")]));
  assert.equal(unreadable.code, 2, unreadable.stdout);
  assert.match(unreadable.stderr, /pack-lint: cannot read .*packs — /);
});

test("main(argv) returns the exit code instead of ending the process", async (t) => {
  const root = repo({ "core/A.cs": "var ok = 1;\n" });
  /** @type {string[]} */
  const printed = [];
  t.mock.method(console, "log", (/** @type {unknown[]} */ ...args) => printed.push(args.join(" ")));
  t.mock.method(console, "error", (/** @type {unknown[]} */ ...args) => printed.push(args.join(" ")));
  try {
    assert.equal(await main(fullArgs(root)), 0);
    assert.equal(await main(["--root", join(root, "core")]), 2);
  } finally {
    t.mock.restoreAll();
  }
  assert.match(printed[0], /^pack-lint: clean \(1 file\(s\) scanned, 2 pack tokens guarded, 0 allowlist/);
  assert.equal(printed[1], "pack-lint: --ext <list> is required");
});
