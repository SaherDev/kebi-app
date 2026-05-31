module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // babel-preset-expo first; jsxImportSource makes className work via NativeWind v4.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      // NativeWind v4 Babel preset: compiles className → StyleSheet at build time.
      'nativewind/babel',
    ],
    plugins: [
      // react-native-reanimated plugin MUST be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
