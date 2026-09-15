// Flat config for the whole kit. The shipped TypeScript source, its Jest tests and the CommonJS
// config files go through config/eslint.base.js, the base every consuming app extends; the Node
// tooling (token generator, checks, node:test suites) keeps plain Node rules.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";

import expoBase from "./config/eslint.base.js";

export default defineConfig([
  { ignores: ["tokens/out/**", ".test-tmp/**"] },
  {
    files: ["**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}", "config/*.js", "*.js", "*.d.ts"],
    extends: [expoBase],
  },
  {
    files: ["jest.setup.js"],
    languageOptions: { globals: globals.jest },
  },
]);
