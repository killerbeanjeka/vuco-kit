// The native-module mocks the kit's source needs off-device, as in vuco's apps/mobile/jest.setup.js.

// expo-localization reads device state natively; tests get a stable en-US device.
// Suites override via jest.requireMock (getLocales is read at call time).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

// Safe-area: components (Sheet) read insets; tests have no provider.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));
