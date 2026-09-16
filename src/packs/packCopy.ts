// The drift contract for a checked-in client copy of pack data (Story 15.3). An app that bundles part
// of a pack (wordings, tax rates, a chase ladder) keeps a test that fails as soon as the copy and the
// pack disagree. A pack edit without the matching copy edit then breaks that test, never a screen.
//
//   import { assertPackCopy } from '@vuco/kit/src/packs/packCopy';
//
//   assertPackCopy(sourcePack, projection, {
//     packVersion: 'version',
//     'rates[key=standard].ratePercent': 'taxRuleTable.rates[key=standard].ratePercent',
//   });
//
// Each pair maps a path in the copy to a path in the pack. A path is dot-separated keys; the segment
// `name[field=value]` selects the one element of the array `name` whose `field` is `value`. Values are
// compared by deep JSON equality: object key order is ignored, array order is not, and a mismatch
// names the first place inside the value where the two differ. A path that does not resolve, or a
// selector that matches no element or several, is a mismatch, never a pass.

/** Copy path → pack path. */
export type PackCopyPairs = Readonly<Record<string, string>>;

export interface PackCopyMismatch {
  copyPath: string;
  packPath: string;
  problem: string;
}

type Segment = { key: string; select?: { field: string; value: string } };
type Resolved = { ok: true; value: unknown } | { ok: false; problem: string };

// One segment: a key, optionally followed by [field=value]. The value may hold dots and `=`.
const SEGMENT = /^([^.[\]]+)(?:\[([^.[\]=]+)=([^\]]*)\])?/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parsePath(path: string): Segment[] | null {
  const segments: Segment[] = [];
  let rest = path;
  for (;;) {
    const match = SEGMENT.exec(rest);
    if (!match) return null;
    const [whole, key, field, value] = match;
    segments.push(field === undefined ? { key } : { key, select: { field, value } });
    rest = rest.slice(whole.length);
    if (rest === '') return segments;
    if (!rest.startsWith('.')) return null;
    rest = rest.slice(1);
  }
}

function matchesSelector(item: unknown, field: string, value: string): boolean {
  if (!isRecord(item) || !hasOwn(item, field)) return false;
  const actual = item[field];
  return (
    (typeof actual === 'string' || typeof actual === 'number' || typeof actual === 'boolean') &&
    String(actual) === value
  );
}

function resolvePath(root: unknown, path: string): Resolved {
  const segments = parsePath(path);
  if (!segments) return { ok: false, problem: `"${path}" is not a valid path` };
  let node = root;
  let at = '';
  for (const { key, select } of segments) {
    at = at ? `${at}.${key}` : key;
    if (!isRecord(node) || !hasOwn(node, key)) return { ok: false, problem: `${at} not found` };
    node = node[key];
    if (select) {
      if (!Array.isArray(node)) return { ok: false, problem: `${at} is not an array` };
      at = `${at}[${select.field}=${select.value}]`;
      const matches = node.filter((item) => matchesSelector(item, select.field, select.value));
      if (matches.length !== 1) return { ok: false, problem: `${at} matches ${matches.length} elements, not 1` };
      node = matches[0];
    }
  }
  return { ok: true, value: node };
}

function preview(value: unknown): string {
  const json = JSON.stringify(value) ?? String(value);
  return json.length > 80 ? `${json.slice(0, 77)}...` : json;
}

/**
 * The first place where `copy` and `pack` differ by deep JSON equality, as a description; null when
 * they are equal. `at` is the position inside the compared value.
 */
function firstDifference(copy: unknown, pack: unknown, at = ''): string | null {
  if (copy === pack) return null;
  const where = at ? `at ${at}: ` : '';
  if (Array.isArray(copy) && Array.isArray(pack)) {
    for (let i = 0; i < Math.min(copy.length, pack.length); i++) {
      const difference = firstDifference(copy[i], pack[i], `${at}[${i}]`);
      if (difference) return difference;
    }
    return copy.length === pack.length
      ? null
      : `${where}copy has ${copy.length} items, pack has ${pack.length}`;
  }
  if (isRecord(copy) && isRecord(pack)) {
    for (const key of Object.keys(copy)) {
      const inner = at ? `${at}.${key}` : key;
      if (!hasOwn(pack, key)) return `at ${inner}: only the copy has this key`;
      const difference = firstDifference(copy[key], pack[key], inner);
      if (difference) return difference;
    }
    const extra = Object.keys(pack).find((key) => !hasOwn(copy, key));
    return extra === undefined ? null : `at ${at ? `${at}.${extra}` : extra}: only the pack has this key`;
  }
  return `${where}copy has ${preview(copy)}, pack has ${preview(pack)}`;
}

/**
 * Every pair whose copy value differs from its pack value or cannot be resolved; empty when the copy
 * matches. Throws when `pairs` is empty, because comparing nothing would always pass.
 */
export function packCopyMismatches(pack: unknown, copy: unknown, pairs: PackCopyPairs): PackCopyMismatch[] {
  const entries = Object.entries(pairs);
  if (entries.length === 0) throw new TypeError('packCopyMismatches needs at least one copy path → pack path pair');
  const mismatches: PackCopyMismatch[] = [];
  for (const [copyPath, packPath] of entries) {
    const inCopy = resolvePath(copy, copyPath);
    const inPack = resolvePath(pack, packPath);
    const problems: string[] = [];
    if (!inCopy.ok) problems.push(`copy: ${inCopy.problem}`);
    if (!inPack.ok) problems.push(`pack: ${inPack.problem}`);
    const difference = inCopy.ok && inPack.ok ? firstDifference(inCopy.value, inPack.value) : null;
    if (difference) problems.push(difference);
    if (problems.length > 0) mismatches.push({ copyPath, packPath, problem: problems.join('; ') });
  }
  return mismatches;
}

/** Throws, listing every mismatch with both paths, unless the copy matches the pack on every pair. */
export function assertPackCopy(pack: unknown, copy: unknown, pairs: PackCopyPairs): void {
  const mismatches = packCopyMismatches(pack, copy, pairs);
  if (mismatches.length === 0) return;
  const lines = mismatches.map(({ copyPath, packPath, problem }) => `  copy ${copyPath} ↔ pack ${packPath}: ${problem}`);
  throw new Error(
    `The pack copy has drifted from its pack (${mismatches.length} mismatch${mismatches.length === 1 ? '' : 'es'}):\n${lines.join('\n')}`,
  );
}
