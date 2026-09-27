// The pack rows of the Story 15.3 I/O matrix (language gap, pack identity, app check), plus the
// validator's report lines and exit codes. Every pack lives in a throw-away folder under the OS temp
// directory. ajv comes in exactly as an app passes it: the default exports of ajv 8 and ajv-formats 3.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  collectTranslatedStrings,
  languageCoverageProblems,
  runPackValidation,
} from "../../src/packs/validatePacks.mjs";

// Passed exactly as an app imports them, with no cast: this file type-checks the README example.
const ajv = { Ajv2020, addFormats };

const scratch = mkdtempSync(join(tmpdir(), "kit-validate-packs-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

// A small app schema: the kit never sees a real one. `updated` proves the formats are switched on.
const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["packId", "version", "schemaVersion", "languages"],
  properties: {
    packId: { type: "string" },
    version: { type: "string" },
    schemaVersion: { type: "integer" },
    languages: { type: "array", items: { type: "string" } },
    updated: { type: "string", format: "date" },
    wordings: { type: "object" },
    fields: { type: "array" },
    smallAmountFields: { type: "array" },
  },
};

/**
 * @param {string} id
 * @param {Record<string, unknown>} [extra]
 */
const pack = (id, extra = {}) => ({
  packId: id,
  version: "1.2.0",
  schemaVersion: 1,
  languages: ["en", "fr"],
  wordings: { greeting: { en: "Hello", fr: "Bonjour" } },
  ...extra,
});

let folders = 0;
/**
 * A packs folder with one pack.json per entry (a string is written as it is) and the schema beside it.
 * @param {Record<string, unknown>} packs  directory name -> pack.json content
 * @param {unknown} [schema]
 */
function packsFolder(packs, schema = SCHEMA) {
  const root = join(scratch, String(folders++));
  const packsDir = join(root, "packs");
  mkdirSync(packsDir, { recursive: true });
  for (const [dir, content] of Object.entries(packs)) {
    mkdirSync(join(packsDir, dir));
    writeFileSync(join(packsDir, dir, "pack.json"), typeof content === "string" ? content : JSON.stringify(content));
  }
  const schemaFile = join(root, "pack.schema.json");
  writeFileSync(schemaFile, JSON.stringify(schema));
  return { packsDir, schemaFile };
}

/**
 * Runs the validator with its console output captured.
 * @param {import("node:test").TestContext} t
 * @param {{ packsDir: string, schemaFile: string }} folder
 * @param {import("../../src/packs/validatePacks.mjs").PackCheck[]} [checks]
 */
async function run(t, folder, checks) {
  /** @type {string[]} */
  const stdout = [];
  /** @type {string[]} */
  const stderr = [];
  t.mock.method(console, "log", (/** @type {unknown[]} */ ...args) => stdout.push(args.join(" ")));
  t.mock.method(console, "error", (/** @type {unknown[]} */ ...args) => stderr.push(args.join(" ")));
  try {
    const code = await runPackValidation({ ...folder, ajv, checks });
    return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
  } finally {
    t.mock.restoreAll();
  }
}

// The shape of vuco's own check: duplicate field keys and small-amount keys that name no field.
/** @type {import("../../src/packs/validatePacks.mjs").PackCheck} */
function fieldCheck(p) {
  const keys = /** @type {{ key: string }[]} */ (p.fields ?? []).map((field) => field.key);
  const problems = [...new Set(keys.filter((key, i) => keys.indexOf(key) !== i))].map(
    (key) => `fields: duplicate key "${key}"`,
  );
  for (const key of /** @type {string[]} */ (p.smallAmountFields ?? [])) {
    if (!keys.includes(key)) problems.push(`smallAmountFields: "${key}" references no existing field key`);
  }
  return problems;
}

test("every valid pack gets its report line and the run exits 0", async (t) => {
  const result = await run(t, packsFolder({ aa: pack("aa"), bb: pack("bb", { languages: ["en"], wordings: {} }) }));
  assert.equal(result.code, 0, result.stderr);
  assert.equal(
    result.stdout,
    "packs/aa/pack.json: valid (schema v1, pack v1.2.0, languages [en, fr] covered)\n" +
      "packs/bb/pack.json: valid (schema v1, pack v1.2.0, languages [en] covered)",
  );
  assert.equal(result.stderr, "");
});

test("a translated string without a declared language fails, naming the JSON path and the language", async (t) => {
  const gap = pack("aa", {
    wordings: { greeting: { en: "Hello", fr: "Bonjour" }, farewell: { en: "Goodbye" } },
    fields: [{ key: "total", label: { fr: "Total" } }],
  });
  const result = await run(t, packsFolder({ aa: gap }));
  assert.equal(result.code, 1);
  assert.equal(
    result.stderr,
    "packs/aa/pack.json: 2 semantic violation(s):\n" +
      '  wordings.farewell: missing "fr" translation (languages[] coverage)\n' +
      '  fields[0].label: missing "en" translation (languages[] coverage)',
  );
});

test("a packId that differs from its directory fails, naming the pack", async (t) => {
  const result = await run(t, packsFolder({ aa: pack("bb"), cc: pack("cc") }));
  assert.equal(result.code, 1);
  assert.equal(result.stderr, 'packs/aa/pack.json: packId "bb" does not match directory "aa"');
  assert.match(result.stdout, /^packs\/cc\/pack\.json: valid/, "one bad pack does not hide the others");
});

const MISNAMED = "not validated — a pack folder is named with its pack id, two lowercase letters";

test("without a two-letter pack directory the run fails with No pack directories", async (t) => {
  const none = await run(t, packsFolder({}));
  assert.equal(none.code, 1);
  assert.equal(none.stderr, "No pack directories (two-letter country dirs) found.");
  const misnamedOnly = await run(t, packsFolder({ abc: pack("abc"), A1: pack("A1"), "d-e": pack("de") }));
  assert.equal(misnamedOnly.code, 1);
  assert.equal(
    misnamedOnly.stderr,
    [
      `packs/A1/pack.json: ${MISNAMED}`,
      `packs/abc/pack.json: ${MISNAMED}`,
      `packs/d-e/pack.json: ${MISNAMED}`,
      "No pack directories (two-letter country dirs) found.",
    ].join("\n"),
  );
});

test("a pack.json in a folder that is not a two-letter pack id fails the run; other folders are ignored", async (t) => {
  const folder = packsFolder({ de: pack("de"), AT: pack("at"), deu: pack("deu") });
  // An app's packs folder also holds tooling: none of it is a pack.
  for (const dir of ["lint", "schema", "node_modules"]) {
    mkdirSync(join(folder.packsDir, dir));
    writeFileSync(join(folder.packsDir, dir, "README.md"), "not a pack");
  }
  const result = await run(t, folder);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, [`packs/AT/pack.json: ${MISNAMED}`, `packs/deu/pack.json: ${MISNAMED}`].join("\n"));
  assert.equal(
    result.stdout,
    "packs/de/pack.json: valid (schema v1, pack v1.2.0, languages [en, fr] covered)",
    "the two-letter pack beside them is still validated",
  );
});

test("a pack.json directly in the packs folder fails the run instead of going unchecked", async (t) => {
  const folder = packsFolder({ de: pack("de") });
  writeFileSync(join(folder.packsDir, "pack.json"), JSON.stringify(pack("zz")));
  const result = await run(t, folder);
  assert.equal(result.code, 1);
  assert.equal(
    result.stderr,
    "packs/pack.json: not validated — a pack sits in a folder named with its pack id, two lowercase letters",
  );
  assert.match(result.stdout, /^packs\/de\/pack\.json: valid/, "the pack beside it is still validated");
});

test("a pack folder whose pack.json cannot be read is exit 2, never a pass", async (t) => {
  const folder = packsFolder({ de: pack("de") });
  mkdirSync(join(folder.packsDir, "AT"));
  const link = join(folder.packsDir, "AT", "pack.json");
  try {
    symlinkSync(link, link, "junction"); // a link to itself: stat fails with ELOOP
  } catch {
    t.skip("this system refuses to create the link");
    return;
  }
  const result = await run(t, folder);
  assert.equal(result.code, 2, result.stderr);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /cannot read the packs directory .*AT[\\/]pack\.json/);
});

test("an app check's problems are reported under the pack, together with the kit's own", async (t) => {
  const broken = pack("aa", {
    wordings: { greeting: { en: "Hello" } },
    fields: [{ key: "total" }, { key: "total" }, { key: "date" }],
    smallAmountFields: ["date", "tax_id"],
  });
  const result = await run(t, packsFolder({ aa: broken }), [fieldCheck]);
  assert.equal(result.code, 1);
  assert.equal(
    result.stderr,
    "packs/aa/pack.json: 3 semantic violation(s):\n" +
      '  wordings.greeting: missing "fr" translation (languages[] coverage)\n' +
      '  fields: duplicate key "total"\n' +
      '  smallAmountFields: "tax_id" references no existing field key',
  );
});

test("an app check that passes leaves the pack valid", async (t) => {
  const clean = pack("aa", { fields: [{ key: "total" }], smallAmountFields: ["total"] });
  const result = await run(t, packsFolder({ aa: clean }), [fieldCheck, () => []]);
  assert.equal(result.code, 0, result.stderr);
});

test("a schema violation lists ajv's path and message; formats are switched on", async (t) => {
  const result = await run(t, packsFolder({ aa: pack("aa", { updated: "someday", schemaVersion: "1" }) }));
  assert.equal(result.code, 1);
  assert.equal(
    result.stderr,
    "packs/aa/pack.json: 2 schema violation(s):\n" +
      "  /schemaVersion must be integer\n" +
      '  /updated must match format "date"',
  );
});

test("a pack that is not valid JSON fails, naming the pack", async (t) => {
  const result = await run(t, packsFolder({ aa: "{ not json" }));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^packs\/aa\/pack\.json: unreadable or invalid JSON — /);
});

test("an unreadable schema or packs directory is exit 2, not a verdict", async (t) => {
  const folder = packsFolder({ aa: pack("aa") });
  const noSchema = await run(t, { ...folder, schemaFile: join(scratch, "missing.schema.json") });
  assert.equal(noSchema.code, 2);
  assert.match(noSchema.stderr, /cannot use the schema/);
  const noPacks = await run(t, { ...folder, packsDir: join(scratch, "missing-packs") });
  assert.equal(noPacks.code, 2);
  assert.match(noPacks.stderr, /cannot read the packs directory/);
});

test("an app check that throws, or returns anything but a list of lines, is exit 2 naming the pack", async (t) => {
  const throwing = () => {
    throw new Error("boom in the app check");
  };
  const cases = [
    [throwing, "packs/aa/pack.json: an app check failed — boom in the app check"],
    [() => "duplicate key", "packs/aa/pack.json: an app check returned string, not a list of problem lines"],
    [() => null, "packs/aa/pack.json: an app check returned null, not a list of problem lines"],
    [() => ["fine", 7], "packs/aa/pack.json: an app check returned a list with entries that are not text, not a list of problem lines"],
  ];
  for (const [check, message] of cases) {
    const result = await run(t, packsFolder({ aa: pack("aa"), bb: pack("bb") }), [/** @type {any} */ (check)]);
    assert.equal(result.code, 2, String(message));
    assert.equal(result.stderr, message);
    assert.equal(result.stdout, "", "no valid line for the pack, and the run stops there");
  }
});

test("a pack without the conventions the kit relies on fails, even when the app schema lets it through", async (t) => {
  const loose = { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object" };
  const cases = [
    [{ packId: "aa" }, ["version: must be a non-empty string", "schemaVersion: must be a non-negative integer or a non-empty string", "languages: must list the pack's languages as two-letter codes"]],
    [{ packId: "aa", version: " ", schemaVersion: -1, languages: ["en"] }, ["version: must be a non-empty string", "schemaVersion: must be a non-negative integer or a non-empty string"]],
    [{ packId: "aa", version: "1.0.0", schemaVersion: 1.5, languages: [] }, ["schemaVersion: must be a non-negative integer or a non-empty string", "languages: must list the pack's languages as two-letter codes"]],
  ];
  for (const [content, problems] of cases) {
    const result = await run(t, packsFolder({ aa: content }, loose));
    assert.equal(result.code, 1, result.stderr);
    assert.equal(result.stdout, "", "no valid line may print");
    const lines = /** @type {string[]} */ (problems);
    assert.equal(result.stderr, [`packs/aa/pack.json: ${lines.length} semantic violation(s):`, ...lines.map((line) => `  ${line}`)].join("\n"));
  }
  const fine = await run(t, packsFolder({ aa: { packId: "aa", version: "1.0.0", schemaVersion: "2026-09", languages: ["en"] } }, loose));
  assert.equal(fine.code, 0, fine.stderr);
  assert.equal(fine.stdout, "packs/aa/pack.json: valid (schema v2026-09, pack v1.0.0, languages [en] covered)");
});

test("the schema compiles in strict mode: a misspelled keyword is exit 2 with ajv's message", async (t) => {
  const misspelled = { ...SCHEMA, properties: { ...SCHEMA.properties, version: { type: "string", minLenght: 1 } } };
  const result = await run(t, packsFolder({ aa: pack("aa") }, misspelled));
  assert.equal(result.code, 2, result.stdout);
  assert.match(result.stderr, /^pack validation: cannot use the schema .*pack\.schema\.json — strict mode: unknown keyword: "minLenght"/);
});

test("ajv must be passed in as imported: a namespace import works too, anything else is exit 2", async (t) => {
  const namespaces = { Ajv2020: { default: Ajv2020 }, addFormats: { default: addFormats } };
  const ok = await runWith(t, namespaces);
  assert.equal(ok.code, 0, ok.stderr);
  const cases = [
    [{ Ajv2020: {}, addFormats }, "pack validation: ajv.Ajv2020 must be the default export of ajv/dist/2020.js (ajv 8)"],
    [{ Ajv2020, addFormats: "ajv-formats" }, "pack validation: ajv.addFormats must be the default export of ajv-formats (3)"],
    [undefined, "pack validation: ajv.Ajv2020 must be the default export of ajv/dist/2020.js (ajv 8)"],
  ];
  for (const [deps, message] of cases) {
    const result = await runWith(t, deps);
    assert.equal(result.code, 2);
    assert.equal(result.stderr, message);
  }

  /**
   * @param {import("node:test").TestContext} t
   * @param {unknown} deps
   */
  async function runWith(t, deps) {
    /** @type {string[]} */
    const stderr = [];
    t.mock.method(console, "log", () => {});
    t.mock.method(console, "error", (/** @type {unknown[]} */ ...args) => stderr.push(args.join(" ")));
    try {
      const code = await runPackValidation({ ...packsFolder({ aa: pack("aa") }), ajv: /** @type {any} */ (deps) });
      return { code, stderr: stderr.join("\n") };
    } finally {
      t.mock.restoreAll();
    }
  }
});

test("translated strings are found by shape at any depth, with their paths", () => {
  const found = collectTranslatedStrings(
    {
      title: { en: "A", de: "B" },
      rates: [{ key: "x", label: { en: "C" } }],
      counts: { en: 1, de: 2 }, // numbers: not a translated string
      byCountry: { de: { note: { en: "D" } } }, // a two-letter key with an object value is walked into
      empty: {},
      gap: { en: "E", de: null }, // null still marks a translated string, so its gap is found
      regional: { "de-AT": "F", en: "G" },
      countries: { at: "H", ch: "I" }, // no declared language among the keys: data, not a translation
      countryCodes: { AT: "J", CH: "K" },
    },
    ["en", "de"],
  );
  assert.deepEqual(found, [
    { path: "title", value: { en: "A", de: "B" } },
    { path: "rates[0].label", value: { en: "C" } },
    { path: "byCountry.de.note", value: { en: "D" } },
    { path: "gap", value: { en: "E", de: null } },
    { path: "regional", value: { "de-AT": "F", en: "G" } },
  ]);
});

test("blank, null, undeclared and regional translations are reported; country-keyed maps are left alone", () => {
  const problems = languageCoverageProblems({
    languages: ["de", "en"],
    blank: { de: "", en: "Title" },
    spaces: { de: "Titel", en: "   " },
    nulled: { de: "Titel", en: null },
    undeclared: { de: "Titel", en: "Title", fr: "Titre" },
    regional: { de: "Titel", "de-AT": "Titel", en: "Title" },
    regionalOnly: { "de-AT": "Titel" },
    byCountry: { at: "Österreich", ch: "Schweiz" },
    byCountryCode: { DE: "Deutschland", AT: "Österreich" },
    fine: { de: "Titel", en: "Title" },
  });
  assert.deepEqual(problems, [
    'blank: "de" translation is empty (languages[] coverage)',
    'spaces: "en" translation is empty (languages[] coverage)',
    'nulled: "en" translation is null (languages[] coverage)',
    'undeclared: "fr" translation for a language languages[] does not declare',
    'regional: "de-AT" translation for a language languages[] does not declare',
    'regionalOnly: missing "de" translation (languages[] coverage)',
    'regionalOnly: missing "en" translation (languages[] coverage)',
    'regionalOnly: "de-AT" translation for a language languages[] does not declare',
  ]);
});

test("a misspelt or undeclared-only translation is still checked; a country code that is no language is data", () => {
  const problems = languageCoverageProblems({
    languages: ["de", "en"],
    upper: { de: "Titel", EN: "Title" },
    lowerRegion: { de: "Titel", "en-us": "Title" },
    underscore: { de: "Titel", en_GB: "Title" },
    spaced: { de: "Titel", "en ": "Title" },
    foreignOnly: { fr: "Titre" },
    countries: { at: "Österreich", li: "Liechtenstein" }, // at is no language code: data
    countryCodes: { DE: "Deutschland", FR: "Frankreich" },
  });
  assert.deepEqual(problems, [
    'upper: missing "en" translation (languages[] coverage)',
    'upper: "EN" translation for a language languages[] does not declare',
    'lowerRegion: missing "en" translation (languages[] coverage)',
    'lowerRegion: "en-us" translation for a language languages[] does not declare',
    'underscore: missing "en" translation (languages[] coverage)',
    'underscore: "en_GB" translation for a language languages[] does not declare',
    'spaced: missing "en" translation (languages[] coverage)',
    'spaced: "en " translation for a language languages[] does not declare',
    'foreignOnly: missing "de" translation (languages[] coverage)',
    'foreignOnly: missing "en" translation (languages[] coverage)',
    'foreignOnly: "fr" translation for a language languages[] does not declare',
  ]);
  // A German-only pack still catches an English-only string, as 0.3.1 did.
  assert.deepEqual(languageCoverageProblems({ languages: ["de"], title: { en: "Hello" } }), [
    'title: missing "de" translation (languages[] coverage)',
    'title: "en" translation for a language languages[] does not declare',
  ]);
});

test("collectTranslatedStrings needs the pack's languages: an old-style call fails loudly", () => {
  assert.throws(() => collectTranslatedStrings({ title: { en: "A" } }, /** @type {any} */ ("title.en")), TypeError);
  assert.throws(() => collectTranslatedStrings({ title: { en: "A" } }, /** @type {any} */ (undefined)), TypeError);
});

test("a blank or null translation fails the pack in the run's report", async (t) => {
  const result = await run(t, packsFolder({ aa: pack("aa", { wordings: { greeting: { en: "Hello", fr: " " }, farewell: { en: null, fr: "Adieu" } } }) }));
  assert.equal(result.code, 1);
  assert.equal(
    result.stderr,
    "packs/aa/pack.json: 2 semantic violation(s):\n" +
      '  wordings.greeting: "fr" translation is empty (languages[] coverage)\n' +
      '  wordings.farewell: "en" translation is null (languages[] coverage)',
  );
});

test("languages that are not two-letter codes fail the coverage check instead of passing on nothing", () => {
  const message = "languages: must list the pack's languages as two-letter codes";
  for (const languages of [undefined, [], ["EN"], ["eng"], [1], "en"]) {
    assert.deepEqual(languageCoverageProblems({ languages, title: { en: "A" } }), [message]);
  }
  assert.deepEqual(languageCoverageProblems(null), [message]);
  assert.deepEqual(languageCoverageProblems({ languages: ["en"], title: { en: "A" } }), []);
});
