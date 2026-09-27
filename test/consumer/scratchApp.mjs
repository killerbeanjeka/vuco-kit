// kit-ci's consumer check (kit 0.4.0, the second consumer's trigger): installs the packed kit into a
// scratch app with every peer, as an app installs a tag, then resolves every path the published docs
// name and loads what Node runs from node_modules: the pack tooling, the version helper and the
// configs. A file the docs promise and the package lacks, a peer that does not resolve, or a config
// whose require fails shows here, before a tag, not in the first app that pins it.
//
//   node test/consumer/scratchApp.mjs
//
// The peers install at the kit's own devDependency versions, the set kit CI tests against. Everything
// happens in a temporary folder, which is removed afterwards; the repository is left as it was.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PUBLISHED_DOCS, extractDocumentedPaths, resolveDocumentedPath } from "./documentedPaths.mjs";

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const windows = process.platform === "win32";

/**
 * Runs npm and returns its stdout. On Windows npm is a .cmd file, which Node starts only through a shell.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function npm(args, cwd) {
  const quoted = windows ? args.map((arg) => (/[\s"]/.test(arg) ? `"${arg}"` : arg)) : args;
  return execFileSync(windows ? "npm.cmd" : "npm", quoted, {
    cwd,
    encoding: "utf8",
    shell: windows,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

/** @type {{ version: string, peerDependencies: Record<string, string>, devDependencies: Record<string, string> }} */
const kitPackage = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"));
const work = mkdtempSync(join(tmpdir(), "kit-scratch-app-"));
/** @type {string[]} */
const failures = [];

try {
  // What a tag publishes: npm pack runs no scripts (kit-ci checks there are none).
  const [packed] = JSON.parse(npm(["pack", "--json", "--pack-destination", work], kitRoot));
  const tarball = join(work, packed.filename);

  const app = join(work, "app");
  mkdirSync(app);
  writeFileSync(join(app, "package.json"), `${JSON.stringify({ name: "kit-scratch-app", version: "0.0.0", private: true }, null, 2)}\n`);
  const peers = Object.keys(kitPackage.peerDependencies).map(
    (name) => `${name}@${kitPackage.devDependencies[name] ?? kitPackage.peerDependencies[name]}`,
  );
  npm(["install", "--no-audit", "--no-fund", "--prefer-offline", "--loglevel=error", tarball, ...peers], app);

  const requireFromApp = createRequire(join(app, "package.json"));
  const kitDir = dirname(requireFromApp.resolve("@vuco/kit/package.json"));
  const installed = JSON.parse(readFileSync(join(kitDir, "package.json"), "utf8")).version;
  if (installed !== kitPackage.version) failures.push(`the scratch app installed @vuco/kit ${installed}, not ${kitPackage.version}`);

  /** @type {Set<string>} */
  const loaded = new Set();
  let paths = 0;
  for (const doc of PUBLISHED_DOCS) {
    /** @type {string} */
    let text;
    try {
      text = readFileSync(join(kitDir, doc), "utf8");
    } catch {
      failures.push(`${doc} is not in the installed kit`);
      continue;
    }
    for (const path of extractDocumentedPaths(text)) {
      paths += 1;
      const files = resolveDocumentedPath(kitDir, path);
      if (files.length === 0) {
        failures.push(`${doc}: @vuco/kit/${path} resolves to no file in the installed kit`);
        continue;
      }
      for (const file of files) {
        if (loaded.has(file)) continue;
        loaded.add(file);
        const absolute = join(kitDir, file);
        try {
          // Node runs these from node_modules in an app; the TypeScript sources go through the app's bundler.
          if (extname(file) === ".mjs") await import(pathToFileURL(absolute).href);
          else if ([".js", ".cjs", ".json"].includes(extname(file))) requireFromApp(absolute);
        } catch (err) {
          failures.push(`${doc}: @vuco/kit/${file} does not load in the scratch app — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  if (failures.length === 0) {
    console.log(
      `scratch app: @vuco/kit ${installed} installed with ${peers.length} peers; ` +
        `${paths} documented paths resolve to ${loaded.size} files, and the Node modules and configs among them load`,
    );
  }
} catch (err) {
  failures.push(`the scratch app could not be set up — ${err instanceof Error ? err.message : String(err)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const failure of failures) console.error(`scratch app: ${failure}`);
process.exitCode = failures.length === 0 ? 0 : 1;
