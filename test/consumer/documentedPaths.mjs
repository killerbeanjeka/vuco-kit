// The consumer paths the kit's published docs name, and the files each stands for inside a kit folder.
// kit-ci's scratch app (scratchApp.mjs) resolves them in a real install of the packed kit;
// documentedPaths.test.mjs applies the same rules to this repository, so a path the docs promise and
// the package lacks fails in `npm test` already. Nothing here is published: it lives under test/.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** The docs that ship in the package and name paths inside it. */
export const PUBLISHED_DOCS = ["README.md", "AGENTS.md", "src/versioning/README.md", "src/vuco-file/README.md"];

/** What an app's bundler, TypeScript or Node tries after an extensionless kit path, in this order. */
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".cjs", ".json"];

/** Folders a walk of a kit folder skips: a repository checkout has them, an installed kit does not. */
const SKIPPED = new Set(["node_modules", ".git", ".test-tmp"]);

/**
 * Every `@vuco/kit/…` path a text names, without the package prefix, in order of first mention:
 * `src/ui/<Name>`, `config/*`, `src/ui/**\/*.{ts,tsx}`. A `node_modules/` prefix comes off with the
 * package name, and trailing sentence punctuation is dropped.
 * @param {string} text
 * @returns {string[]}
 */
export function extractDocumentedPaths(text) {
  /** @type {string[]} */
  const found = [];
  for (const match of text.matchAll(/@vuco\/kit\/([^\s`'"()[\]]+)/g)) {
    const path = (match[1] ?? "").replace(/[.,;:]+$/, "");
    if (path !== "" && !found.includes(path)) found.push(path);
  }
  return found;
}

/**
 * The files one documented path stands for inside a kit folder, as an app resolves it: the file
 * itself, a module named without its extension, or a folder's index module. A pattern stands for
 * every file it matches: `<Name>` and `*` match within one path segment, `**` across segments, and
 * `{a,b}` either alternative. Empty when nothing matches.
 * @param {string} kitDir
 * @param {string} path  a documented path without the `@vuco/kit/` prefix
 * @returns {string[]}  paths relative to kitDir, with forward slashes
 */
export function resolveDocumentedPath(kitDir, path) {
  if (/[<*{]/.test(path)) {
    const pattern = patternToRegExp(path);
    return listFiles(kitDir).filter((file) => pattern.test(file));
  }
  const candidates = [
    path,
    ...EXTENSIONS.map((extension) => `${path}${extension}`),
    ...EXTENSIONS.map((extension) => `${path}/index${extension}`),
  ];
  const hit = candidates.find((candidate) => isFile(join(kitDir, candidate)));
  return hit === undefined ? [] : [hit];
}

/**
 * @param {string} pattern
 * @returns {RegExp}
 */
function patternToRegExp(pattern) {
  /** @param {string} text */
  const escape = (text) => text.replace(/[.+?^$()|[\]\\]/g, "\\$&");
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "<") {
      source += "[^/]+";
      i = pattern.indexOf(">", i);
    } else if (char === "*" && pattern[i + 1] === "*") {
      const slash = pattern[i + 2] === "/";
      source += slash ? "(?:.*/)?" : ".*";
      i += slash ? 2 : 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "{") {
      const end = pattern.indexOf("}", i);
      source += `(?:${pattern.slice(i + 1, end).split(",").map(escape).join("|")})`;
      i = end;
    } else {
      source += escape(char ?? "");
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * Every file under a folder, relative to it, with forward slashes, in a stable order.
 * @param {string} root
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listFiles(root, prefix = "") {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) files.push(...listFiles(root, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort();
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
