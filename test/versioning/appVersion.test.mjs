// The version rows of the Story 15.3 I/O matrix: the three bumps, and every input the helper refuses.
import assert from "node:assert/strict";
import { test } from "node:test";

import { BUMP_KINDS, bumpAppVersion, formatAppVersion, parseAppVersion } from "../../src/versioning/appVersion.mjs";

test("fix, story and epic bump 0.1.10.2 by the project rules", () => {
  assert.equal(bumpAppVersion("0.1.10.2", "fix"), "0.1.10.3");
  assert.equal(bumpAppVersion("0.1.10.2", "story"), "0.1.11.1");
  assert.equal(bumpAppVersion("0.1.10.2", "epic"), "0.2.0.1");
  assert.deepEqual(BUMP_KINDS, ["fix", "story", "epic"]);
});

test("MAJOR never moves, and zero segments are valid", () => {
  assert.equal(bumpAppVersion("3.0.0.0", "fix"), "3.0.0.1");
  assert.equal(bumpAppVersion("3.0.0.0", "story"), "3.0.1.1");
  assert.equal(bumpAppVersion("3.9.9.9", "epic"), "3.10.0.1");
});

test("an invalid version name throws and names the input", () => {
  for (const text of ["0.1.10", "0.01.1.1", "v0.1.1.1", "1.2.3.x", "0.1.1.1.1", "", " 0.1.1.1", "0.1.1.1\n", "0.1.-1.1"]) {
    assert.throws(() => bumpAppVersion(text, "fix"), { message: new RegExp(`^invalid app version ${JSON.stringify(text).replace(/[.\\]/g, "\\$&")}`) });
    assert.throws(() => parseAppVersion(text), /MAJOR\.EPIC\.STORY\.BUILD/);
  }
  for (const value of [undefined, null, 1.2, ["0", "1", "1", "1"]]) {
    assert.throws(() => parseAppVersion(value), /^Error: invalid app version/);
  }
  // Beyond Number.MAX_SAFE_INTEGER a segment can no longer be counted exactly.
  assert.throws(() => parseAppVersion("0.1.1.9007199254740993"), /invalid app version "0\.1\.1\.9007199254740993"/);
});

test("an unknown kind throws and names it; major is not a kind", () => {
  for (const kind of ["major", "MAJOR", "Fix", "build", "", undefined]) {
    assert.throws(() => bumpAppVersion("0.1.10.2", kind), {
      message: `unknown bump kind ${JSON.stringify(kind)}: expected fix, story, epic (MAJOR moves only by the owner's hand)`,
    });
  }
});

test("the version is checked before the kind", () => {
  assert.throws(() => bumpAppVersion("0.1.10", "major"), /invalid app version "0\.1\.10"/);
});

test("parse and format round-trip", () => {
  assert.deepEqual(parseAppVersion("0.1.10.2"), { major: 0, epic: 1, story: 10, build: 2 });
  assert.equal(formatAppVersion({ major: 12, epic: 0, story: 105, build: 3 }), "12.0.105.3");
  for (const text of ["0.0.0.0", "1.22.333.4444"]) assert.equal(formatAppVersion(parseAppVersion(text)), text);
});

test("format refuses segments that are not non-negative integers", () => {
  const bad = [
    { major: -1, epic: 0, story: 0, build: 1 },
    { major: 0, epic: 1.5, story: 0, build: 1 },
    { major: 0, epic: 1, story: Number.NaN, build: 1 },
    { major: 0, epic: 1, story: 0 },
    { major: 0, epic: 1, story: 0, build: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const version of bad) {
    assert.throws(() => formatAppVersion(/** @type {any} */ (version)), /^Error: invalid app version/);
  }
  assert.throws(() => formatAppVersion(/** @type {any} */ (undefined)), /invalid app version/);
  assert.throws(() => bumpAppVersion(`0.1.1.${Number.MAX_SAFE_INTEGER}`, "fix"), /invalid app version/);
});
