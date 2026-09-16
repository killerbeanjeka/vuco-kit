// The generic core of a vuco-family app's pack validator (Story 15.3; moved from vuco's
// packs/validate-pack.mjs). The app keeps its pack schema, its pack data and its own semantic checks.
// The kit owns the walk over <packsDir>/<id>/pack.json, the ajv settings, the packId and language
// checks, and the report.
//
//   import Ajv2020 from 'ajv/dist/2020.js';
//   import addFormats from 'ajv-formats';
//   import { runPackValidation } from '@vuco/kit/src/packs/validatePacks.mjs';
//
//   process.exitCode = await runPackValidation({
//     packsDir, schemaFile, ajv: { Ajv2020, addFormats }, checks: [appChecks],
//   });
//
// The caller passes in ajv 8 and ajv-formats 3, which it already installs. If the kit declared them,
// every app would install them, and an optional peer would clash with the ajv 6 that eslint hoists in
// an app. The kit still owns the settings: JSON Schema 2020-12, `strict`, `allErrors`, and formats.
//
// Pack conventions the kit relies on: a pack lives at <packsDir>/<id>/pack.json, where <id> is two
// lowercase letters; `packId` equals <id>; the pack has `version`, `schemaVersion` and `languages[]`.
// A translated string is any object whose keys are all two-letter language codes and whose values
// are all strings. Every other pack field, and the whole schema, belongs to the app (AD-1).
//
// Exit codes (returned, never passed to process.exit): 0 = every pack is valid; 1 = a pack failed, or
// there is no pack directory; 2 = the schema or the packs directory cannot be read or compiled.

import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

const TWO_LETTERS = /^[a-z]{2}$/;

/**
 * @typedef {object} TranslatedString
 * @property {string} path  where it sits in the pack: dot-separated keys, `[i]` for array items
 * @property {Record<string, string>} value
 */

/**
 * The slice of an ajv 8 instance this module uses.
 * @typedef {object} AjvInstance
 * @property {(schema: unknown) => AjvValidate} compile
 */

/**
 * @typedef {((data: unknown) => boolean) & { errors?: { instancePath: string, message?: string }[] | null }} AjvValidate
 */

/**
 * @typedef {object} AjvDependencies
 * @property {new (options: { allErrors: boolean, strict: boolean }) => AjvInstance} Ajv2020
 *   the default export of `ajv/dist/2020.js` (ajv 8)
 * @property {(ajv: AjvInstance) => unknown} addFormats  the default export of `ajv-formats` (3)
 */

/**
 * An app's own semantic check. It returns one line per problem, and an empty array when the pack passes.
 * @typedef {(pack: Record<string, unknown>) => string[]} PackCheck
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} err */
const reason = (err) => (err instanceof Error ? err.message : String(err));

/**
 * Every translated string in a pack, matched by shape, so a new pack slot is covered without a code
 * change.
 * @param {unknown} node
 * @param {string} [path]  the path of `node` itself
 * @param {TranslatedString[]} [out]
 * @returns {TranslatedString[]}
 */
export function collectTranslatedStrings(node, path = "", out = []) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectTranslatedStrings(item, `${path}[${i}]`, out));
    return out;
  }
  if (!isRecord(node)) return out;
  const keys = Object.keys(node);
  if (keys.length > 0 && keys.every((key) => TWO_LETTERS.test(key) && typeof node[key] === "string")) {
    out.push({ path, value: /** @type {Record<string, string>} */ (node) });
    return out;
  }
  for (const key of keys) collectTranslatedStrings(node[key], path ? `${path}.${key}` : key, out);
  return out;
}

/**
 * languages[] coverage: every translated string provides every language the pack declares. A pack
 * whose `languages` is not a non-empty list of two-letter codes fails too, because the coverage check
 * would otherwise pass on nothing.
 * @param {unknown} pack
 * @returns {string[]}
 */
export function languageCoverageProblems(pack) {
  const languages = isRecord(pack) ? pack.languages : undefined;
  if (
    !Array.isArray(languages) ||
    languages.length === 0 ||
    !languages.every((language) => typeof language === "string" && TWO_LETTERS.test(language))
  ) {
    return ["languages: must list the pack's languages as two-letter codes"];
  }
  const problems = [];
  for (const { path, value } of collectTranslatedStrings(pack)) {
    for (const language of languages) {
      if (!Object.prototype.hasOwnProperty.call(value, language)) {
        problems.push(`${path}: missing "${language}" translation (languages[] coverage)`);
      }
    }
  }
  return problems;
}

/**
 * Validates every pack under `packsDir` and prints one report line per pack: `valid (…)` on stdout,
 * or the problems on stderr.
 * @param {object} options
 * @param {string} options.packsDir  the folder that holds one <id>/pack.json per pack
 * @param {string} options.schemaFile  the app's pack schema (JSON Schema 2020-12)
 * @param {AjvDependencies} options.ajv
 * @param {PackCheck[]} [options.checks]  the app's own semantic checks, run after the kit's
 * @returns {Promise<0 | 1 | 2>}
 */
export async function runPackValidation({ packsDir, schemaFile, ajv, checks = [] }) {
  /** @param {string} id */
  const label = (id) => `${basename(packsDir)}/${id}/pack.json`;

  /** @type {AjvValidate} */
  let validate;
  try {
    const schema = JSON.parse(await readFile(schemaFile, "utf8"));
    const instance = new ajv.Ajv2020({ allErrors: true, strict: true });
    ajv.addFormats(instance);
    validate = instance.compile(schema);
  } catch (err) {
    console.error(`pack validation: cannot use the schema ${schemaFile} — ${reason(err)}`);
    return 2;
  }

  /** @type {string[]} */
  let ids;
  try {
    ids = (await readdir(packsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && TWO_LETTERS.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (err) {
    console.error(`pack validation: cannot read the packs directory ${packsDir} — ${reason(err)}`);
    return 2;
  }
  if (ids.length === 0) {
    console.error("No pack directories (two-letter country dirs) found.");
    return 1;
  }

  let failed = false;
  for (const id of ids) {
    /** @type {unknown} */
    let pack;
    try {
      pack = JSON.parse(await readFile(join(packsDir, id, "pack.json"), "utf8"));
    } catch (err) {
      console.error(`${label(id)}: unreadable or invalid JSON — ${reason(err)}`);
      failed = true;
      continue;
    }
    if (!validate(pack)) {
      failed = true;
      const errors = validate.errors ?? [];
      console.error(`${label(id)}: ${errors.length} schema violation(s):`);
      for (const error of errors) console.error(`  ${error.instancePath || "/"} ${error.message}`);
      continue;
    }
    if (!isRecord(pack) || pack.packId !== id) {
      failed = true;
      const packId = isRecord(pack) ? pack.packId : undefined;
      console.error(`${label(id)}: packId "${packId}" does not match directory "${id}"`);
      continue;
    }
    const problems = languageCoverageProblems(pack);
    for (const check of checks) {
      const found = check(pack);
      if (!Array.isArray(found)) throw new TypeError(`a pack check returned ${typeof found}, not an array of problems`);
      problems.push(...found);
    }
    if (problems.length > 0) {
      failed = true;
      console.error(`${label(id)}: ${problems.length} semantic violation(s):`);
      for (const problem of problems) console.error(`  ${problem}`);
      continue;
    }
    const languages = /** @type {string[]} */ (pack.languages);
    console.log(
      `${label(id)}: valid (schema v${pack.schemaVersion}, pack v${pack.version}, languages [${languages.join(", ")}] covered)`,
    );
  }
  return failed ? 1 : 0;
}
