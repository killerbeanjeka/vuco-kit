// The slice of eslint-config-expo 57.0.0 that config/eslint.base.js uses; the package ships no type declarations.
declare module "eslint-config-expo/flat" {
  import type { Linter } from "eslint";

  const config: Linter.Config[];
  export = config;
}
