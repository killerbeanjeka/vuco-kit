// The ESLint flat config every vuco-family app extends: Expo's flat config
// (https://docs.expo.dev/guides/using-eslint/) with the web export folder ignored.
//
//   // eslint.config.js in the app
//   const { defineConfig } = require('eslint/config');
//   module.exports = defineConfig([require('@vuco/kit/config/eslint.base.js'), /* app rules */]);
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);
