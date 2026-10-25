// The peers the Expo SDK patch raised (kit 0.12.0) follow the devDependencies the kit is tested with: each is `~` and
// the devDependency's exact version, so npm refuses the kit beside an app still on an older set, and the pin and the SDK
// patch cannot drift apart.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const kitRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** @type {{ peerDependencies: Record<string, string>, devDependencies: Record<string, string> }} */
const kitPackage = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"));

for (const name of ["expo", "react-native", "expo-router", "expo-localization", "eslint-config-expo"]) {
  test(`the ${name} peer is ~ and the ${name} devDependency's version`, () => {
    const tested = kitPackage.devDependencies[name];
    assert.match(tested ?? "", /^\d+\.\d+\.\d+$/, `the ${name} devDependency is an exact version`);
    assert.equal(kitPackage.peerDependencies[name], `~${tested}`);
  });
}
