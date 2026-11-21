// The version rows of the Story 15.3 I/O matrix: the three bumps, and every input the helper refuses.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import {
  BUMP_KINDS,
  IOS_BUILD_BOUND,
  bumpAppVersion,
  formatAppVersion,
  iosVersionName,
  parseAppVersion,
} from "../../src/versioning/appVersion.mjs";

test("fix, story and epic bump 0.1.10.2 by the project rules", () => {
  assert.equal(bumpAppVersion("0.1.10.2", "fix"), "0.1.10.3");
  assert.equal(bumpAppVersion("0.1.10.2", "story"), "0.1.11.1");
  assert.equal(bumpAppVersion("0.1.10.2", "epic"), "0.2.0.1");
  assert.deepEqual(BUMP_KINDS, ["fix", "story", "epic"]);
});

test("MAJOR never moves, and MAJOR, EPIC and STORY may be 0", () => {
  assert.equal(bumpAppVersion("3.0.0.1", "fix"), "3.0.0.2");
  assert.equal(bumpAppVersion("3.0.0.1", "story"), "3.0.1.1");
  assert.equal(bumpAppVersion("3.9.9.9", "epic"), "3.10.0.1");
  assert.deepEqual(parseAppVersion("0.0.0.1"), { major: 0, epic: 0, story: 0, build: 1 });
});

test("BUILD 0 is not a version name: BUILD starts at 1", () => {
  for (const text of ["0.1.1.0", "0.0.0.0", "1.2.3.0"]) {
    assert.throws(() => parseAppVersion(text), {
      message: `invalid app version "${text}": expected MAJOR.EPIC.STORY.BUILD, four non-negative integers without leading zeros and a BUILD of at least 1`,
    });
    assert.throws(() => bumpAppVersion(text, "fix"), /BUILD of at least 1/);
  }
  assert.throws(() => formatAppVersion({ major: 0, epic: 1, story: 1, build: 0 }), /BUILD of at least 1/);
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
  for (const text of ["0.0.0.1", "1.22.333.4444"]) assert.equal(formatAppVersion(parseAppVersion(text)), text);
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

// The iOS version name: the rows of the I/O matrix of vuco's Story 18.1.
test("the iOS version name is MAJOR.EPIC.(STORY × 1000 + BUILD)", () => {
  assert.equal(iosVersionName("0.3.1.4"), "0.3.1004"); // the founder's example
  assert.equal(iosVersionName("0.3.2.1"), "0.3.2001"); // the first build of a story
  assert.equal(iosVersionName("0.4.0.1"), "0.4.1"); // story 0
  assert.equal(iosVersionName("1.2.10.999"), "1.2.10999"); // the last BUILD that has a name
  assert.equal(IOS_BUILD_BOUND, 1000);
});

test("a BUILD at the bound has no iOS version name: it throws and names the version and the bound", () => {
  assert.throws(() => iosVersionName("0.3.1.1000"), {
    message: 'no iOS version name for "0.3.1.1000": BUILD 1000 is not below 1000',
  });
  assert.throws(() => iosVersionName("0.3.1.4321"), /^Error: no iOS version name for "0\.3\.1\.4321": BUILD 4321 is not below 1000$/);
  // A STORY so large that STORY × 1000 + BUILD can no longer be counted exactly.
  assert.throws(() => iosVersionName("0.3.9007199254741.5"), {
    message: 'no iOS version name for "0.3.9007199254741.5": STORY 9007199254741 is too large to share a number with BUILD',
  });
});

test("what is not an app version has no iOS version name: it throws as parseAppVersion does", () => {
  for (const value of ["0.3.1", "v0.3.1.4", "0.3.1.0", null, undefined, "", "0.3.1004", 0.3]) {
    let expected = "";
    try {
      parseAppVersion(value);
    } catch (error) {
      expected = /** @type {Error} */ (error).message;
    }
    assert.match(expected, /^invalid app version /);
    assert.throws(() => iosVersionName(value), { message: expected });
  }
});

test("iOS version names keep the order of the app versions, and no two versions share one", () => {
  // In app-version order: fix, story and epic bumps, a MAJOR step, and both edges of BUILD.
  const ordered = [
    "0.0.0.1", "0.0.0.2", "0.0.0.999", "0.0.1.1", "0.0.9.999", "0.0.10.1", "0.1.0.1", "0.3.1.4", "0.3.1.5",
    "0.3.1.999", "0.3.2.1", "0.3.999.999", "0.4.0.1", "0.10.0.1", "1.0.0.1", "1.2.10.999", "2.0.0.1",
  ];
  const names = ordered.map((version) => iosVersionName(version));
  /** @param {string} name */
  const parts = (name) => name.split(".").map(Number);
  for (let index = 1; index < names.length; index += 1) {
    const [before, after] = [parts(names[index - 1]), parts(names[index])];
    const differs = before.findIndex((part, position) => part !== after[position]);
    assert.ok(differs !== -1 && before[differs] < after[differs], `${names[index - 1]} must sort before ${names[index]}`);
  }
  // Three integers without leading zeros: what iOS accepts.
  for (const name of names) assert.match(name, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
});

// An Expo app config (app.config.js) is CommonJS: it reaches the helper with require(), not import.
test("the helper loads with require(), as an app's CommonJS config loads it", () => {
  const helper = createRequire(import.meta.url)("../../src/versioning/appVersion.mjs");
  assert.equal(helper.iosVersionName("0.3.1.4"), "0.3.1004");
  assert.equal(helper.iosVersionName, iosVersionName); // the same module instance as the import
});
