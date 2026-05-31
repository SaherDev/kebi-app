/**
 * Babel config for Jest tests only.
 *
 * Strips the NativeWind + Reanimated presets that cause test environment issues:
 * - nativewind/babel: not needed because className is mocked in tests
 * - react-native-reanimated/plugin: causes "multiple React copies" error in Jest
 *
 * The test transform therefore uses plain babel-preset-expo with React JSX
 * so that all components compile correctly without native side effects.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      'babel-preset-expo',
    ],
  };
};
