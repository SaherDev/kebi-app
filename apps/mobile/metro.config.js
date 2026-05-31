const { getDefaultConfig } = require('@expo/metro-config');
const { mergeConfig } = require('metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

// Keep projectRoot as apps/mobile so Babel and asset resolution work correctly.
// Add libs/shared to watchFolders so Metro picks up live source changes.
// withNativeWind wraps the merged config to compile global.css via Tailwind v3.
const monorepoRoot = path.resolve(__dirname, '../..');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const customConfig = {
  cacheVersion: 'mobile-a3-rev',
  watchFolders: [
    path.join(monorepoRoot, 'libs/shared'),
    path.join(monorepoRoot, 'node_modules'),
  ],
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
    // Resolve @kebi-app/shared via the @kebi-app/source export condition
    // (same custom condition as tsconfig.base.json) so Metro reads src/ directly.
    unstable_enablePackageExports: true,
    unstable_conditionNames: [
      '@kebi-app/source',
      'require',
      'import',
      'react-native',
      'browser',
      'default',
    ],
    nodeModulesPaths: [
      path.join(monorepoRoot, 'node_modules'),
      path.join(__dirname, 'node_modules'),
    ],
  },
};

module.exports = withNativeWind(mergeConfig(defaultConfig, customConfig), {
  input: './src/global.css',
});
