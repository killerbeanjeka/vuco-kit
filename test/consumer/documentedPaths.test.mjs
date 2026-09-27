// The consumer contract kit 0.4.0 adds for its second consumer (vuco:walk Story 1.1): every path the
// published docs name exists in the published layout, the rules that resolve those paths behave as an
// app's resolver does, and the release ritual names every consumer folder that pins the kit. kit-ci's
// scratch app (scratchApp.mjs) then resolves the same paths in a real install of the packed kit.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLISHED_DOCS, extractDocumentedPaths, resolveDocumentedPath } from "./documentedPaths.mjs";

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** @type {{ files: string[] }} */
const kitPackage = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"));

const scratch = mkdtempSync(join(tmpdir(), "kit-documented-paths-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

/**
 * Whether npm publishes a file: it sits under a `files` entry, or npm always includes it.
 * @param {string} file
 */
const published = (file) =>
  ["package.json", "README.md", "LICENSE"].includes(file) ||
  kitPackage.files.some((entry) => file === entry || file.startsWith(`${entry}/`));

test("paths are read from a text with their prefixes, placeholders and patterns", () => {
  const text = [
    "Import `@vuco/kit/src/ui/<Name>`, then `require('@vuco/kit/config/eslint.base.js')`.",
    "Scan './node_modules/@vuco/kit/src/ui/**/*.{ts,tsx}' and import @node_modules/@vuco/kit/AGENTS.md.",
    "Again: @vuco/kit/src/ui/<Name>; and (@vuco/kit/src/i18n), and `@vuco/kit` alone.",
  ].join("\n");
  assert.deepEqual(extractDocumentedPaths(text), [
    "src/ui/<Name>",
    "config/eslint.base.js",
    "src/ui/**/*.{ts,tsx}",
    "AGENTS.md",
    "src/i18n",
  ]);
});

test("a documented path resolves as an app resolves it: file, extensionless module, folder index or pattern", () => {
  const kit = join(scratch, "kit");
  for (const file of ["src/ui/Sheet.tsx", "src/ui/deep/Row.tsx", "src/i18n/index.ts", "src/i18n/en.json", "config/eslint.base.js", "tokens/fonts/Face-Bold.ttf"]) {
    mkdirSync(dirname(join(kit, file)), { recursive: true });
    writeFileSync(join(kit, file), "");
  }
  assert.deepEqual(resolveDocumentedPath(kit, "config/eslint.base.js"), ["config/eslint.base.js"]);
  assert.deepEqual(resolveDocumentedPath(kit, "src/ui/Sheet"), ["src/ui/Sheet.tsx"]);
  assert.deepEqual(resolveDocumentedPath(kit, "src/i18n"), ["src/i18n/index.ts"]);
  assert.deepEqual(resolveDocumentedPath(kit, "src/ui/<Name>"), ["src/ui/Sheet.tsx"], "<Name> stays within one segment");
  assert.deepEqual(resolveDocumentedPath(kit, "config/*"), ["config/eslint.base.js"]);
  assert.deepEqual(resolveDocumentedPath(kit, "src/ui/**/*.{ts,tsx}"), ["src/ui/Sheet.tsx", "src/ui/deep/Row.tsx"]);
  assert.deepEqual(resolveDocumentedPath(kit, "tokens/fonts/Face-<Weight>.ttf"), ["tokens/fonts/Face-Bold.ttf"]);
  assert.deepEqual(resolveDocumentedPath(kit, "src/ui/Missing"), []);
  assert.deepEqual(resolveDocumentedPath(kit, "src/i18n/*.yaml"), []);
  // A placeholder with a space is cut at the space by the extractor: the check names it, not hangs.
  assert.throws(() => resolveDocumentedPath(kit, "src/ui/<Primitive"), /unclosed "<" in the documented path src\/ui\/<Primitive/);
  assert.throws(() => resolveDocumentedPath(kit, "src/ui/*.{ts"), /unclosed "\{" in the documented path/);
});

test("every path the published docs name resolves to files the package publishes", () => {
  let paths = 0;
  for (const doc of PUBLISHED_DOCS) {
    assert.ok(published(doc), `${doc} is not published`);
    for (const path of extractDocumentedPaths(readFileSync(join(kitRoot, doc), "utf8"))) {
      paths += 1;
      const files = resolveDocumentedPath(kitRoot, path);
      assert.notDeepEqual(files, [], `${doc}: @vuco/kit/${path} names no file`);
      for (const file of files) assert.ok(published(file), `${doc}: @vuco/kit/${path} → ${file} is not published`);
    }
  }
  // The docs name the theme, the fonts, the primitives, i18n, the pack tooling, the configs and more.
  assert.ok(paths >= 12, `only ${paths} documented paths found`);
});

test("CONTRIBUTING step 6 moves every consumer, both folders of each, the same day", () => {
  const contributing = readFileSync(join(kitRoot, "CONTRIBUTING.md"), "utf8");
  const start = contributing.indexOf("6. **Consumer bump");
  // Line breaks and indentation are layout, not content.
  const step6 = contributing.slice(start, contributing.indexOf("## Rules", start)).replace(/\s+/g, " ");
  assert.notEqual(start, -1, "step 6 is missing");
  for (const consumer of ["vuco (`killerbeanjeka/vuco-app`)", "vuco:walk (`killerbeanjeka/vuco-walk`)"]) {
    assert.ok(step6.includes(consumer), `step 6 does not name ${consumer}`);
  }
  assert.ok(step6.includes("ux-vuco-2026-07-15/DESIGN.md"), "step 6 does not name vuco's DESIGN.md");
  assert.ok(step6.includes("ux-vuco-walk-2026-09-16/DESIGN.md"), "step 6 does not name vuco:walk's DESIGN.md");
  assert.ok(step6.includes('`apps/mobile` (`npm install "@vuco/kit@github:killerbeanjeka/vuco-kit#vX.Y.Z"`)'));
  assert.ok(step6.includes('`packs` (`npm install -D "@vuco/kit@github:killerbeanjeka/vuco-kit#vX.Y.Z"`)'));
});
