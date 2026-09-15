#!/usr/bin/env node
// A light-only colour token on a dual-mode surface is invisible text — and it is invisible in the
// one mode nobody runs the test suite in.
//
// It has shipped: a status line — the single line its story existed to surface — was styled with a
// light-only near-black amber token, and on the dark surface the warning simply was not there. A
// reviewer caught it by reading; nothing could have failed. A scan then found a second, identical
// case two screens away, so this is a class of defect, not an incident.
//
// The rule: if a token has a `-dark` counterpart in the generated theme, every use of it must be
// paired with that counterpart under the same variant chain. Tokens with no `-dark` counterpart are
// mode-independent by construction and are not the subject here.
//
// A node script rather than a jest test because it reads the filesystem, and app tsconfigs
// deliberately exclude Node types so that Node APIs cannot leak into app code. check-tnum.mjs is
// the precedent: a token invariant, verified by a node script, wired into CI.
//
//   node check-dark-pairing.mjs --src <dir> --allowlist <file.json> [--theme <file>]
//
//   --src        the source tree to scan: every .tsx file under it except *.test.tsx
//   --allowlist  JSON object {"<path relative to --src>": "<why the surface is single-mode>"}
//   --theme      the generated NativeWind theme (default: out/vuco/nativewind-theme.cjs beside
//                this file)
//
// Exit codes: 0 = every use paired; 1 = unpaired uses, or an allowlist entry with no reason or no
// file; 2 = bad arguments or unreadable input — never confuse an error with a verdict.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} msg
 * @returns {never}
 */
function usageError(msg) {
  console.error(`check-dark-pairing: ${msg}`);
  console.error('usage: node check-dark-pairing.mjs --src <dir> --allowlist <file.json> [--theme <file>]');
  process.exit(2);
}

/** @param {unknown} err */
const reason = (err) => (err instanceof Error ? err.message : String(err));

/**
 * The value that follows `name` on the command line; undefined when the flag is absent.
 * @param {string} name
 * @returns {string | undefined}
 */
function flag(name) {
  const args = process.argv.slice(2);
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith('--')) usageError(`${name} needs a value`);
  return value;
}

const srcFlag = flag('--src');
const allowlistFlag = flag('--allowlist');
if (srcFlag === undefined) usageError('--src <dir> is required');
if (allowlistFlag === undefined) usageError('--allowlist <file.json> is required');
const ROOT = resolve(srcFlag);
const THEME = resolve(flag('--theme') ?? join(here, 'out/vuco/nativewind-theme.cjs'));
if (!statSync(ROOT, { throwIfNoEntry: false })?.isDirectory()) usageError(`--src ${srcFlag} is not a directory`);

// Surfaces that are deliberately single-mode, owned by the consuming app. Each entry states the
// decision — an allowlist with no stated reason is just a disabled check.
/** @type {Record<string, unknown>} */
let INTENTIONALLY_SINGLE_MODE;
try {
  const parsed = JSON.parse(readFileSync(resolve(allowlistFlag), 'utf8'));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object');
  INTENTIONALLY_SINGLE_MODE = parsed;
} catch (err) {
  usageError(`cannot use allowlist ${allowlistFlag} — ${reason(err)}`);
}

/** Every colour token that has a `-dark` sibling — i.e. every token this rule applies to. */
function tokensWithDarkVariants() {
  /** @type {unknown} */
  let colors;
  try {
    // Loaded, not text-matched: a key the generator writes unquoted (primary, link, accent) counts
    // exactly like a quoted one.
    colors = createRequire(import.meta.url)(THEME)?.theme?.colors;
  } catch (err) {
    usageError(`cannot load theme ${THEME} — ${reason(err)}`);
  }
  if (colors === null || typeof colors !== 'object') usageError(`${THEME} has no theme.colors`);
  const names = new Set(Object.keys(colors));
  /** @type {Set<string>} */
  const paired = new Set();
  for (const name of names) {
    if (name.endsWith('-dark') && names.has(name.slice(0, -5))) {
      paired.add(name.slice(0, -5));
    }
  }
  return paired;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function tsxFilesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFilesUnder(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

/**
 * Unpaired utilities in one className string. The variant chain matters: a `placeholder:text-x` is
 * paired only by a `dark:placeholder:text-x-dark`, never by a bare one.
 * @param {string} className
 * @param {Set<string>} darkTokens
 */
function unpairedIn(className, darkTokens) {
  const classes = className.split(/\s+/).filter(Boolean);
  const present = new Set(classes);
  const problems = [];

  for (const cls of classes) {
    const parts = cls.split(':');
    const variants = parts.slice(0, -1);
    const utility = parts[parts.length - 1];
    if (variants.includes('dark')) continue;

    const match = /^(text|bg|border)-(.+)$/.exec(utility);
    if (!match) continue;
    const [, kind, token] = match;
    if (!darkTokens.has(token)) continue; // mode-independent token — nothing to pair with

    // `dark:` may lead the chain or follow the other variants; both are valid Tailwind.
    const expected = [
      ['dark', ...variants, `${kind}-${token}-dark`].join(':'),
      [...variants, 'dark', `${kind}-${token}-dark`].join(':'),
    ];
    if (!expected.some((candidate) => present.has(candidate))) {
      problems.push(`${cls}  (needs ${expected[0]})`);
    }
  }
  return problems;
}

const darkTokens = tokensWithDarkVariants();
if (darkTokens.size < 5) {
  // The scan is worthless if the theme yielded (almost) nothing, and it would pass loudly.
  usageError(`found only ${darkTokens.size} dual-mode colour tokens in ${THEME} — not a generated theme?`);
}

/** @type {string[]} */
const failures = [];
for (const file of tsxFilesUnder(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (rel in INTENTIONALLY_SINGLE_MODE) continue;

  const source = readFileSync(file, 'utf8');
  const strings = [
    ...[...source.matchAll(/className="([^"]*)"/g)].map((m) => m[1]),
    // Ternary branches and computed class strings: `? 'font-meta text-status-failed-text'`
    ...[...source.matchAll(/'((?:[a-z0-9-]+:)*(?:text|bg|border)-[a-z0-9-]+[^']*)'/g)].map((m) => m[1]),
  ];
  for (const value of strings) {
    for (const problem of unpairedIn(value, darkTokens)) {
      failures.push(`${rel}: ${problem}`);
    }
  }
}

// Stale allowlist entries are permanently silent exemptions, and the next file to land at that path
// would inherit one without anyone deciding to. An entry without a reason is a disabled check.
for (const [rel, why] of Object.entries(INTENTIONALLY_SINGLE_MODE)) {
  if (typeof why !== 'string' || why.trim() === '') {
    failures.push(`allowlist entry states no reason: ${rel}`);
  }
  if (!statSync(join(ROOT, rel), { throwIfNoEntry: false })) {
    failures.push(`allowlist names a file that no longer exists: ${rel}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: light-only colour tokens on dual-mode surfaces\n');
  for (const failure of [...new Set(failures)].sort()) console.error(`  ${failure}`);
  console.error(
    '\nEach of these renders in the light token on the dark surface. Pair it with the -dark\n' +
      'variant, or — if the surface is deliberately single-mode — add it to the allowlist\n' +
      `(${allowlistFlag}) WITH the reason.`,
  );
  process.exit(1);
}

console.log(`OK: every use of the ${darkTokens.size} dual-mode colour tokens is paired with its dark variant.`);
