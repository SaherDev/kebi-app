/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: 'mobile',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    // Pin all react imports to a single instance to prevent "invalid hook call"
    // from pnpm deduplication gaps (react@19.2.4 vs react@19.2.3 copies).
    '^react$': require.resolve('react'),
    '^react/jsx-runtime$': require.resolve('react/jsx-runtime'),
    '^react/jsx-dev-runtime$': require.resolve('react/jsx-dev-runtime'),
    '\\.svg$': '@nx/expo/plugins/jest/svg-mock',
    // CSS imports (global.css) are no-ops in Jest; NativeWind handles them at Metro build time.
    '\\.css$': '<rootDir>/src/test-utils/css-mock.js',
    // Expo 56 installs lazy polyfill getters (fetch, URL, TextDecoder, …) via
    // winter/runtime.native.  In Jest these lazy require() calls fail with
    // "import outside test scope" when the getter is first accessed.  Map the
    // whole runtime module to a no-op so no lazy getters are registered.
    'expo/src/winter/runtime\\.native': '<rootDir>/src/test-utils/expo-runtime-mock.js',
    // Also intercept bare './runtime' resolved from winter/index.ts
    'expo/src/winter/runtime$': '<rootDir>/src/test-utils/expo-runtime-mock.js',
    // safe-area-context wrapper (jest-expo mocks the native module; we just
    // need the JS wrapper to return usable stubs).
    '^react-native-safe-area-context$': '<rootDir>/src/test-utils/safe-area-mock.js',
  },
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        // Use the test-only babel config (no NativeWind / Reanimated plugins)
        // to avoid the "multiple React copies" dispatcher error in Jest.
        configFile: __dirname + '/babel.config.test.js',
      },
    ],
    '^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$': require.resolve(
      'jest-expo/src/preset/assetFileTransformer.js'
    ),
  },
  coverageDirectory: '../../coverage/apps/mobile',
  testPathIgnorePatterns: [
    '/node_modules/',
    'babel\\.config\\.test\\.js',
  ],
};