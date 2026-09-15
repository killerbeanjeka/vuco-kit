// Jest for the UI primitives and the i18n factory, on the stack vuco's apps/mobile tests use: the
// jest-expo preset, NativeWind's JSX import source (babel.config.js), and the safe-area and
// expo-localization mocks (jest.setup.js). The node:test suites (test/*.test.mjs) run under node.
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['<rootDir>/test/**/*.test.{ts,tsx}'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@formatjs/.*|nativewind|react-native-css-interop)/)',
  ],
};
