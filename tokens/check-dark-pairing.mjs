// A light-only colour token on a dual-mode surface is invisible text — and it is invisible in the
// one mode nobody runs the test suite in.
//
// Story 6.1b's delivery line, the single line that story exists to surface, shipped as
// `text-status-failed-text` with no dark variant. That token is #92400E, a near-black amber: on the
// dark surface the craftsman's "delivery failed" warning simply was not there. A reviewer caught it
// by reading. Nothing could have failed — and scanning then found a second, identical case two
// screens away in Story 6.1's SendSheet errors, so this is a class of defect, not an incident.
//
// The rule: if a token has a `-dark` counterpart in the generated theme, every use of it must be
// paired with that counterpart under the same variant chain. Tokens with no `-dark` counterpart are
// mode-independent by construction and are not the subject here.
//
// Lives here rather than in the mobile jest suite because it reads the filesystem, and
// apps/mobile's tsconfig deliberately excludes Node types so that Node APIs cannot leak into app
// code. check-tnum.mjs is the precedent: a token invariant, verified by a node script, wired into
// the design-tokens workflow.
//
//   node design/tokens/check-dark-pairing.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const THEME = join(here, 'out/nativewind-theme.cjs');
const ROOT = join(here, '../../apps/mobile/src');

// Surfaces that are deliberately single-mode. Each entry states the decision — an allowlist with no
// stated reason is just a disabled check.
const INTENTIONALLY_SINGLE_MODE = {
  'ui/LetterheadPreview.tsx':
    'Paper. The letterhead preview shows how the printed document will look, and a document is ' +
    'white in both app themes — stated at the top of the file.',
  'features/invoices/InvoiceDocumentPreview.tsx':
    'Paper. A representative miniature of the printed invoice / Factur-X PDF, which is white paper ' +
    'in both app themes — stated at the top of the file ("Paper is paper", the LetterheadPreview ' +
    'convention). Pairing these to -dark variants would wrongly darken the document sheet.',
  'app/(tabs)/settings.tsx':
    'The theme picker renders the light and dark swatches side by side ON PURPOSE, so the ' +
    'craftsman can see both before choosing. Pairing them would defeat the control.',
  'app/dev-font-probe.tsx': 'A developer-only probe screen; never on a customer path.',
};

/** Every colour token that has a `-dark` sibling — i.e. every token this rule applies to. */
function tokensWithDarkVariants() {
  const source = readFileSync(THEME, 'utf8');
  const names = new Set([...source.matchAll(/['"]([a-z0-9-]+)['"]:/g)].map((m) => m[1]));
  const paired = new Set();
  for (const name of names) {
    if (name.endsWith('-dark') && names.has(name.slice(0, -5))) {
      paired.add(name.slice(0, -5));
    }
  }
  return paired;
}

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
  // The scan is worthless if the theme parse silently yielded nothing, and it would pass loudly.
  console.error(`FAIL: parsed only ${darkTokens.size} dual-mode tokens from ${THEME} — parse is broken.`);
  process.exit(1);
}

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
// would inherit one without anyone deciding to.
for (const rel of Object.keys(INTENTIONALLY_SINGLE_MODE)) {
  try {
    statSync(join(ROOT, rel));
  } catch {
    failures.push(`allowlist names a file that no longer exists: ${rel}`);
  }
}

if (failures.length > 0) {
  console.error('FAIL: light-only colour tokens on dual-mode surfaces\n');
  for (const failure of [...new Set(failures)].sort()) console.error(`  ${failure}`);
  console.error(
    '\nEach of these renders in the light token on the dark surface. Pair it with the -dark\n' +
      'variant, or — if the surface is deliberately single-mode — add it to\n' +
      'INTENTIONALLY_SINGLE_MODE in this file WITH the reason.',
  );
  process.exit(1);
}

console.log(`OK: every use of the ${darkTokens.size} dual-mode colour tokens is paired with its dark variant.`);
