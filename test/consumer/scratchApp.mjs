// kit-ci's consumer check (kit 0.4.0, the second consumer's trigger): installs the packed kit into a
// scratch app with every peer, as an app installs a tag, then resolves every path the published docs
// name. The modules Node runs from node_modules (the pack tooling, the version helper, the ESLint
// config) load; the TypeScript base config is parsed by TypeScript, its `extends` included; every
// package the TypeScript sources import resolves from where they sit. A file the docs promise and the
// package lacks, a peer that does not resolve, or a config that does not load shows here, before a tag,
// not in the first app that pins it.
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
 * Runs npm and returns its stdout. On Windows npm is a .cmd file, which Node starts only through a
 * shell, so every argument is quoted: cmd.exe would otherwise read `^`, `>` or `|` in a version range.
 * A hung registry fails the run after ten minutes instead of blocking CI.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function npm(args, cwd) {
  return execFileSync(windows ? "npm.cmd" : "npm", windows ? args.map((arg) => `"${arg}"`) : args, {
    cwd,
    encoding: "utf8",
    shell: windows,
    stdio: ["ignore", "pipe", "inherit"],
    timeout: 10 * 60_000,
  });
}

/**
 * The packages a TypeScript source imports by name: `from '…'`, `import '…'` and `require('…')`,
 * without relative paths.
 * @param {string} source
 * @returns {string[]}
 */
function packageImports(source) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const match of source.matchAll(/\bfrom\s*['"]([^'"./][^'"]*)['"]|\bimport\s*['"]([^'"./][^'"]*)['"]|\brequire\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g)) {
    names.add(match[1] ?? match[2] ?? match[3] ?? "");
  }
  names.delete("");
  return [...names];
}

/**
 * Whether a package an installed kit file imports resolves from that file, as an app's bundler would
 * find it. A subpath that Node's `require` conditions do not expose still counts when the package
 * itself is installed: the bundler may use other conditions.
 * @param {string} file  absolute path of the importing file
 * @param {string} specifier
 * @returns {boolean}
 */
function importResolves(file, specifier) {
  const requireFromFile = createRequire(file);
  try {
    requireFromFile.resolve(specifier);
    return true;
  } catch {
    const segments = specifier.split("/");
    const name = specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
    try {
      requireFromFile.resolve(`${name}/package.json`);
      return true;
    } catch {
      return false;
    }
  }
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
  /** @type {any} */
  const ts = requireFromApp("typescript");
  /**
   * The problems TypeScript reports for a config file, "no inputs" excepted: a base config has none.
   * @param {string} file
   * @returns {string[]}
   */
  const parseTsConfig = (file) => {
    /** @type {any[]} */
    const diagnostics = [];
    const parsed = ts.getParsedCommandLineOfConfigFile(file, {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (/** @type {any} */ diagnostic) => diagnostics.push(diagnostic),
    });
    return [...diagnostics, ...(parsed?.errors ?? [])]
      .filter((diagnostic) => diagnostic.code !== 18003)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, " "));
  };
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
      /** @type {string[]} */
      let files;
      try {
        files = resolveDocumentedPath(kitDir, path);
      } catch (err) {
        failures.push(`${doc}: @vuco/kit/${path} — ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      if (files.length === 0) {
        failures.push(`${doc}: @vuco/kit/${path} resolves to no file in the installed kit`);
        continue;
      }
      for (const file of files) {
        if (loaded.has(file)) continue;
        loaded.add(file);
        const absolute = join(kitDir, file);
        try {
          if (/(^|\/)tsconfig[^/]*\.json$/.test(file)) {
            // TypeScript reads its configs with comments and `extends`: parse them the way tsc does.
            const errors = parseTsConfig(absolute);
            if (errors.length > 0) failures.push(`${doc}: @vuco/kit/${file} does not parse in the scratch app — ${errors.join("; ")}`);
          } else if ([".ts", ".tsx"].includes(extname(file))) {
            // The app's bundler compiles these; the packages they import must resolve from where they sit.
            for (const specifier of packageImports(readFileSync(absolute, "utf8"))) {
              if (!importResolves(absolute, specifier)) failures.push(`${doc}: @vuco/kit/${file} imports ${specifier}, which does not resolve in the scratch app`);
            }
          } else if (extname(file) === ".mjs") {
            await import(pathToFileURL(absolute).href);
          } else if ([".js", ".cjs", ".json"].includes(extname(file))) {
            requireFromApp(absolute);
          }
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
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (err) {
    // A scanner holding a file in the fresh node_modules must not hide the verdict.
    console.warn(`scratch app: could not remove ${work} — ${err instanceof Error ? err.message : String(err)}`);
  }
}

for (const failure of failures) console.error(`scratch app: ${failure}`);
process.exitCode = failures.length === 0 ? 0 : 1;
