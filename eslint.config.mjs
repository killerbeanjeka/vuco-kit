// Flat config for the kit's Node tooling: token generator, checks, tests.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["tokens/out/**"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: globals.node },
  },
];
